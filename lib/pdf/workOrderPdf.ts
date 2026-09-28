import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import type { Client, Job, Tenant, Vehicle } from '@/types/database';

// A4 in PDF points.
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.46, 0.52);
const RULE = rgb(0.85, 0.87, 0.9);

interface WorkOrderInput {
  tenant: Tenant;
  client: Client;
  vehicle: Vehicle;
  job: Job;
  dtcCodes: string[];
}

// The standard PDF fonts have no č/ć/đ, so a real font is embedded (and
// subset, keeping the file small). DejaVu, because fontkit's subsetter
// drops glyphs from Noto Sans. Traced into the serverless bundle via
// outputFileTracingIncludes in next.config.mjs.
async function loadFonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), 'lib', 'pdf', 'fonts');
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, 'DejaVuSans.ttf')),
    readFile(path.join(dir, 'DejaVuSans-Bold.ttf')),
  ]);
  return {
    regular: await doc.embedFont(regular, { subset: true }),
    bold: await doc.embedFont(bold, { subset: true }),
  };
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function buildWorkOrderPdf({ tenant, client, vehicle, job, dtcCodes }: WorkOrderInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);
  const reference = job.id.slice(0, 8).toUpperCase();
  const contentWidth = PAGE.width - MARGIN * 2;

  doc.setTitle(`Radni nalog ${reference}`);
  doc.setAuthor(tenant.name);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  function ensureSpace(height: number) {
    if (y - height < MARGIN + 40) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  }

  function text(value: string, x: number, size: number, options: { bold?: boolean; color?: typeof INK } = {}) {
    page.drawText(value, { x, y, size, font: options.bold ? fonts.bold : fonts.regular, color: options.color ?? INK });
  }

  function rightText(value: string, rightX: number, size: number, options: { bold?: boolean; color?: typeof INK } = {}) {
    const font = options.bold ? fonts.bold : fonts.regular;
    text(value, rightX - font.widthOfTextAtSize(value, size), size, options);
  }

  function rule() {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.8, color: RULE });
  }

  function section(label: string, body: string) {
    const lines = wrap(body, fonts.regular, 10.5, contentWidth);
    ensureSpace(22 + lines.length * 15);
    y -= 22;
    text(label.toUpperCase(), MARGIN, 8, { bold: true, color: MUTED });
    for (const line of lines) {
      y -= 15;
      ensureSpace(15);
      text(line, MARGIN, 10.5);
    }
  }

  // Header: workshop left, document id right.
  text(tenant.name, MARGIN, 16, { bold: true });
  rightText('RADNI NALOG / PREDRAČUN', PAGE.width - MARGIN, 8, { bold: true, color: MUTED });
  y -= 22;
  if (tenant.address) text(tenant.address, MARGIN, 10, { color: MUTED });
  rightText(reference, PAGE.width - MARGIN, 18, { bold: true });
  y -= 14;
  if (tenant.phone) text(tenant.phone, MARGIN, 10, { color: MUTED });
  y -= 6;
  rightText(new Date(job.created_at).toLocaleDateString('hr-HR'), PAGE.width - MARGIN, 10, { color: MUTED });
  y -= 14;
  rule();

  // Client | vehicle.
  const colX = MARGIN + contentWidth / 2;
  y -= 22;
  text('KLIJENT', MARGIN, 8, { bold: true, color: MUTED });
  text('VOZILO', colX, 8, { bold: true, color: MUTED });
  const left = [
    `${client.first_name} ${client.last_name}`,
    client.phone_number,
    client.address ?? '',
    client.oib ? `OIB: ${client.oib}` : '',
  ].filter(Boolean);
  const right = [vehicleLabel(vehicle), vehicle.vin ? `VIN: ${vehicle.vin}` : '', vehicle.year ? `Godina: ${vehicle.year}` : ''].filter(Boolean);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    y -= 15;
    if (left[i]) text(left[i], MARGIN, 10.5, { bold: i === 0 });
    if (right[i]) text(right[i], colX, 10.5, { bold: i === 0 });
  }

  section('Status', JOB_STATUS_LABELS_HR[job.status]);
  if (dtcCodes.length > 0) section('DTC kodovi', dtcCodes.join(', '));
  if (job.diagnostic_notes) section('Dijagnostika', job.diagnostic_notes);
  if (job.work_summary) section('Izvedeni radovi', job.work_summary);

  // Amounts: labels left, figures right.
  const rows: [string, number][] = [
    ['Rad', job.total_labor_cost],
    ['Dijelovi', job.total_parts_cost],
  ];
  if (job.accrued_parking_fees > 0) rows.push(['Ležarina', job.accrued_parking_fees]);
  ensureSpace(40 + rows.length * 16 + 40);
  y -= 26;
  rule();
  for (const [label, amount] of rows) {
    y -= 18;
    text(label, MARGIN, 10.5, { color: MUTED });
    rightText(formatEuroHR(amount), PAGE.width - MARGIN, 10.5);
  }
  y -= 12;
  rule();
  y -= 20;
  text('Ukupno', MARGIN, 12, { bold: true });
  rightText(formatEuroHR(jobTotal(job)), PAGE.width - MARGIN, 14, { bold: true });

  if (job.payment_status === 'PAID') {
    y -= 22;
    rightText(
      `PLAĆENO${job.paid_at ? ` ${new Date(job.paid_at).toLocaleDateString('hr-HR')}` : ''}`,
      PAGE.width - MARGIN,
      11,
      { bold: true, color: rgb(0.02, 0.5, 0.35) }
    );
  }

  // Footer on every page.
  const footer = 'Interni radni nalog / predračun, a ne fiskalizirani račun u smislu Zakona o fiskalizaciji.';
  for (const p of doc.getPages()) {
    const width = fonts.regular.widthOfTextAtSize(footer, 8);
    p.drawText(footer, { x: (PAGE.width - width) / 2, y: MARGIN - 18, size: 8, font: fonts.regular, color: MUTED });
  }

  return doc.save();
}
