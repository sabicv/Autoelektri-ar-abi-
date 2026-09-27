import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { newMechanicSchema, removeStaffSchema } from '@/lib/validation/staff';

// Owner-only management of mechanic accounts. Creating a login needs the
// service-role client (auth.admin), so this never goes through RLS; the
// tenant always comes from the caller's own profile, never the body.

export const dynamic = 'force-dynamic';

async function loadOwnerProfile() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Samo vlasnik radionice može upravljati djelatnicima.' }, { status: 403 }) };
  }

  return { profile };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { profile, error } = await loadOwnerProfile();
  if (error) return error;

  const parsed = newMechanicSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provjerite podatke.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { fullName, email, password } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    const alreadyExists = createError?.code === 'email_exists' || createError?.status === 422;
    return NextResponse.json(
      { error: alreadyExists ? 'Korisnik s tom e-mail adresom već postoji.' : 'Kreiranje računa nije uspjelo.' },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    tenant_id: profile.tenant_id,
    full_name: fullName,
    role: 'mechanic',
  });

  if (profileError) {
    // A login without a profile can sign in but is bounced from /dashboard
    // with no explanation — never leave one behind.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error('Staff create: profile insert failed', profileError);
    return NextResponse.json({ error: 'Kreiranje računa nije uspjelo.' }, { status: 500 });
  }

  return NextResponse.json({
    staff: { id: created.user.id, full_name: fullName, role: 'mechanic', email },
  });
}

export async function DELETE(request: Request) {
  const { profile, error } = await loadOwnerProfile();
  if (error) return error;

  const parsed = removeStaffSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('profiles')
    .select('*')
    .eq('id', parsed.data.profileId)
    .maybeSingle();

  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Djelatnik nije pronađen.' }, { status: 404 });
  }
  if (target.role !== 'mechanic') {
    return NextResponse.json({ error: 'Vlasnički račun se ne može ukloniti.' }, { status: 403 });
  }

  // profiles.id cascades from auth.users, so this removes both.
  const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
  if (deleteError) {
    console.error('Staff delete failed', deleteError);
    return NextResponse.json({ error: 'Uklanjanje djelatnika nije uspjelo.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
