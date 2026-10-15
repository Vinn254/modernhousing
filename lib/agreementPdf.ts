// Client-side tenancy agreement PDF generator (pdf-lib).
// Produces a printable agreement with the landlord's description, the selected
// checklist items (marked with the tenant's ticks), the tenant's profile details,
// and signature blocks for Tenant, Landlord and the Advocate (arbitrator).

export interface AgreementItem {
  id: string;
  category: string;
  label: string;
  body_text?: string | null;
  sort_order?: number;
}

export interface AgreementForPdf {
  title?: string;
  description?: string | null;
  items?: AgreementItem[];
  tenant_checks?: string[];
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  tenant_national_id?: string;
  tenant_kra_pin?: string;
  tenant_address?: string;
  unit_number?: string;
  property_name?: string;
  tenant_picture_url?: string;
  submitted_at?: string | null;
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

export async function generateAgreementPdf(agreement: AgreementForPdf): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawWrapped(text: string, opts: { font: any; size: number; color?: any; gap?: number; indent?: number }) {
    const maxWidth = PAGE_WIDTH - MARGIN * 2 - (opts.indent ?? 0);
    const words = text.split(/\s+/);
    let line = '';
    const out: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (opts.font.widthOfTextAtSize(test, opts.size) > maxWidth) {
        if (line) out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    const lineHeight = opts.size + (opts.gap ?? 4);
    for (const l of out) {
      ensureSpace(lineHeight);
      page.drawText(l, { x: MARGIN + (opts.indent ?? 0), y, font: opts.font, size: opts.size, color: opts.color ?? ink });
      y -= lineHeight;
    }
  }

  // ---- Header ----
  page.drawText('SPRINGFIELD SYSTEMS', { x: MARGIN, y, font: boldFont, size: 16, color: rgb(0.08, 0.08, 0.15) });
  y -= 24;
  page.drawText(agreement.title || 'Tenancy Agreement', { x: MARGIN, y, font: boldFont, size: 20, color: ink });
  y -= 18;
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-GB')}`, { x: MARGIN, y, font, size: 9, color: muted });
  y -= 24;

  // ---- Tenant profile block ----
  const checked = new Set(agreement.tenant_checks ?? []);
  const profileTop = y;
  let pictureBottom = profileTop;

  if (agreement.tenant_picture_url) {
    try {
      const res = await fetch(agreement.tenant_picture_url);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
        const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
        if (isPng || isJpg) {
          const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const box = 72;
          const scale = Math.min(box / img.width, box / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: MARGIN, y: profileTop - h, width: w, height: h });
          pictureBottom = profileTop - h;
        }
      }
    } catch (e) {
      // Unsupported format (e.g. WebP) — continue without picture.
    }
  }

  const detailX = MARGIN + 92;
  let dy = profileTop - 4;
  const detail = (label: string, value?: string | null) => {
    if (!value) return;
    page.drawText(label, { x: detailX, y: dy, font: boldFont, size: 9, color: muted });
    page.drawText(String(value).substring(0, 48), { x: detailX + 82, y: dy, font, size: 9, color: ink });
    dy -= 14;
  };
  page.drawText('TENANT DETAILS', { x: detailX, y: dy, font: boldFont, size: 11, color: ink });
  dy -= 16;
  detail('Name:', agreement.tenant_name);
  detail('Email:', agreement.tenant_email);
  detail('Phone:', agreement.tenant_phone);
  detail('National ID:', agreement.tenant_national_id);
  detail('KRA PIN:', agreement.tenant_kra_pin);
  detail('Property:', agreement.property_name);
  detail('Unit:', agreement.unit_number);
  detail('Address:', agreement.tenant_address);

  y = Math.min(pictureBottom, dy) - 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 22;

  // ---- Description ----
  if (agreement.description && agreement.description.trim()) {
    ensureSpace(40);
    page.drawText('AGREEMENT DESCRIPTION', { x: MARGIN, y, font: boldFont, size: 12, color: ink });
    y -= 18;
    drawWrapped(agreement.description.trim(), { font, size: 10, gap: 5 });
    y -= 12;
  }

  // ---- Checklist items ----
  ensureSpace(40);
  page.drawText('AGREEMENT ITEMS', { x: MARGIN, y, font: boldFont, size: 12, color: ink });
  y -= 8;
  page.drawText('Items marked [X] were checked and accepted by the tenant.', { x: MARGIN, y, font, size: 8, color: muted });
  y -= 18;

  let lastCategory = '';
  (agreement.items ?? []).forEach((item) => {
    const category = item.category ?? '';
    if (category && category !== lastCategory) {
      ensureSpace(30);
      y -= 4;
      page.drawText(category.toUpperCase(), { x: MARGIN, y, font: boldFont, size: 9.5, color: rgb(0.2, 0.35, 0.6) });
      y -= 16;
      lastCategory = category;
    }
    const mark = checked.has(item.id) ? '[X]' : '[  ]';
    ensureSpace(30);
    page.drawText(`${mark} ${item.label}`, { x: MARGIN, y, font: boldFont, size: 10, color: ink });
    y -= 14;
    if (item.body_text) {
      drawWrapped(item.body_text, { font, size: 9, color: rgb(0.25, 0.25, 0.28), gap: 3, indent: 26 });
      y -= 6;
    }
  });

  // ---- Acknowledgement ----
  y -= 8;
  ensureSpace(50);
  drawWrapped(
    agreement.tenant_checks && agreement.tenant_checks.length > 0
      ? `The tenant acknowledged and submitted this agreement on ${agreement.submitted_at ? new Date(agreement.submitted_at).toLocaleString('en-GB') : 'the date recorded in the system'}.`
      : 'This agreement has not yet been acknowledged/submitted by the tenant.',
    { font: font, size: 9, color: muted, gap: 3 }
  );

  // ---- Signature blocks ----
  y -= 30;
  ensureSpace(150);
  page.drawText('SIGNATURES', { x: MARGIN, y, font: boldFont, size: 12, color: ink });
  y -= 28;

  const sigLine = (label: string) => {
    ensureSpace(56);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 230, y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(label, { x: MARGIN, y: y - 14, font, size: 9, color: muted });
    page.drawLine({ start: { x: MARGIN + 320, y }, end: { x: MARGIN + 440, y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Date', { x: MARGIN + 320, y: y - 14, font, size: 9, color: muted });
    y -= 46;
  };

  sigLine("Tenant's Signature");
  sigLine('In presence of Advocate');
  sigLine("Landlord's Signature");
  sigLine('In presence of Advocate');

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
