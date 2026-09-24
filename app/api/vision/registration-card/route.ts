import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =====================================================================
// Reads a photographed Croatian vehicle registration card (prometna
// dozvola) and extracts structured fields to pre-fill the "Novi nalog"
// form. The mechanic still reviews/edits every field before submitting —
// this only removes typing, it never writes to the database directly.
// =====================================================================

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  photoPath: z.string().min(1),
});

const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

interface ExtractedFields {
  firstName: string | null;
  lastName: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  registrationPlate: string | null;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI čitanje dokumenata nije konfigurirano.' }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'Nalog nije povezan s radionicom.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nedostaje putanja fotografije.' }, { status: 400 });
  }

  const { photoPath } = parsed.data;

  // photoPath must live inside the caller's own tenant folder — this route
  // uses the admin client to read it (temp-staged files aren't readable by
  // the staff RLS policies, which only cover the final {tenant}/{job}/...
  // path), so we enforce tenant ownership manually instead.
  if (!photoPath.startsWith(`${profile.tenant_id}/`)) {
    return NextResponse.json({ error: 'Nemate pristup ovoj fotografiji.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: fileBlob, error: downloadError } = await admin.storage.from('job-vault').download(photoPath);

  if (downloadError || !fileBlob) {
    return NextResponse.json({ error: 'Fotografija nije pronađena.' }, { status: 404 });
  }

  const extension = photoPath.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mediaType = MEDIA_TYPE_BY_EXTENSION[extension] ?? 'image/jpeg';
  const base64Data = Buffer.from(await fileBlob.arrayBuffer()).toString('base64');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              {
                type: 'text',
                text:
                  'Ovo je fotografija hrvatske prometne dozvole. Izvuci sljedeće podatke i odgovori ISKLJUČIVO ' +
                  'jednim JSON objektom, bez ikakvog dodatnog teksta, bez markdown ograda:\n' +
                  '{"firstName": string|null, "lastName": string|null, "make": string|null, "model": string|null, ' +
                  '"year": number|null, "vin": string|null, "registrationPlate": string|null}\n' +
                  'firstName/lastName su vlasnik vozila (polje C.1.1/C.1.2 ili slično). make/model su marka/tip ' +
                  'vozila (D.1/D.3). year je godina prve registracije (B). vin je broj šasije (E). ' +
                  'registrationPlate je registarska oznaka (A). Ako neko polje nije čitljivo ili ga nema, ' +
                  'stavi null — nemoj izmišljati podatke.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Anthropic vision call failed', response.status, errText);
      return NextResponse.json({ error: 'AI čitanje dokumenta nije uspjelo.' }, { status: 502 });
    }

    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    const textBlock = json.content?.find((block) => block.type === 'text')?.text ?? '';

    const jsonMatch = textBlock.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI nije uspio pročitati dokument.' }, { status: 502 });
    }

    let extracted: ExtractedFields;
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: 'AI odgovor nije bilo moguće protumačiti.' }, { status: 502 });
    }

    return NextResponse.json({ fields: extracted });
  } catch (error) {
    console.error('Vision extraction error', error);
    return NextResponse.json({ error: 'AI čitanje dokumenta nije uspjelo.' }, { status: 502 });
  }
}
