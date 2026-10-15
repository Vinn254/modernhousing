// Client-side tenancy agreement PDF generator (pdf-lib).
// Mirrors the layout of the signed Springfield RENTAL LEASE: the description
// carries the document preamble, clauses print with their full wording, and the
// property condition items are laid out as Appendix 1 — a bordered table of
// rooms x [condition on commencement | comments | condition on end | comments].

import { CATEGORY_LEASE, CONDITION_COLUMNS, LEASE_LANDLORD, LEASE_ADDRESS } from './leaseText';

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
const USABLE = PAGE_WIDTH - MARGIN * 2;

// Appendix 1 column widths: item then the four condition/comment columns.
const CONDITION_WIDTHS = [115, 100, 92, 100, 88];

export async function generateAgreementPdf(agreement: AgreementForPdf): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);
  const rule = rgb(0.65, 0.68, 0.72);
  const headerFill = rgb(0.93, 0.95, 0.97);

  // Footers are stamped once the page count is known.
  function stampFooters() {
    const total = pdfDoc.getPageCount();
    for (let i = 0; i < total; i++) {
      const p = pdfDoc.getPage(i);
      p.drawText('Tenants sign...................................   Landlords sign............................', {
        x: MARGIN,
        y: 30,
        font,
        size: 8,
        color: muted,
      });
      p.drawText(`Page ${i + 1} of ${total}`, {
        x: PAGE_WIDTH - MARGIN - 60,
        y: 30,
        font,
        size: 8,
        color: muted,
      });
    }
  }

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 30) newPage();
  }

  function measure(text: string, size: number, bold = false) {
    return (bold ? boldFont : font).widthOfTextAtSize(text, size);
  }

  function wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
    const out: string[] = [];
    for (const para of text.split('\n')) {
      if (!para.trim()) {
        out.push('');
        continue;
      }
      let line = '';
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (measure(test, size, bold) > maxWidth) {
          if (line) out.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  function drawWrapped(text: string, opts: { size: number; color?: any; gap?: number; indent?: number; bold?: boolean; width?: number }) {
    const maxWidth = opts.width ?? USABLE - (opts.indent ?? 0);
    const lineHeight = opts.size + (opts.gap ?? 4);
    for (const l of wrap(text, opts.size, maxWidth, opts.bold)) {
      ensureSpace(lineHeight);
      page.drawText(l, {
        x: MARGIN + (opts.indent ?? 0),
        y,
        font: opts.bold ? boldFont : font,
        size: opts.size,
        color: opts.color ?? ink,
      });
      y -= lineHeight;
    }
  }

  function heading(text: string, size = 12) {
    ensureSpace(46);
    y -= 6;
    page.drawText(text, { x: MARGIN, y, font: boldFont, size, color: ink });
    y -= 16;
  }

  // ---- Appendix 1 style bordered table ----
  function drawTable(columns: string[], rows: string[][], opts: { rowHeight?: number }) {
    const widths = columns.length === CONDITION_WIDTHS.length ? CONDITION_WIDTHS : columns.map(() => USABLE / columns.length);
    const cellPad = 5;
    const minRow = opts.rowHeight ?? 20;

    function cellLines(value: string, size: number, colIndex: number, bold: boolean) {
      return wrap(value || '', size, widths[colIndex] - cellPad * 2, bold);
    }

    function drawRow(cells: string[], opts2: { size: number; bold: boolean; fill?: any; min: number }) {
      const heights = cells.map((c, i) => cellLines(c, opts2.size, i, opts2.bold).length * (opts2.size + 2) + cellPad * 2);
      const rowH = Math.max(opts2.min, ...heights);
      ensureSpace(rowH);
      const top = y;
      if (opts2.fill) page.drawRectangle({ x: MARGIN, y: top - rowH, width: USABLE, height: rowH, color: opts2.fill });
      let x = MARGIN;
      cells.forEach((c, i) => {
        let ty = top - cellPad - opts2.size;
        for (const l of cellLines(c, opts2.size, i, opts2.bold)) {
          page.drawText(l, { x: x + cellPad, y: ty, font: opts2.bold ? boldFont : font, size: opts2.size, color: ink });
          ty -= opts2.size + 2;
        }
        x += widths[i];
      });
      // Grid on the left of each column plus the row's bottom rule.
      x = MARGIN;
      widths.forEach((w) => {
        page.drawLine({ start: { x, y: top }, end: { x, y: top - rowH }, thickness: 0.5, color: rule });
        x += w;
      });
      page.drawLine({ start: { x: MARGIN + USABLE, y: top }, end: { x: MARGIN + USABLE, y: top - rowH }, thickness: 0.5, color: rule });
      page.drawLine({ start: { x: MARGIN, y: top - rowH }, end: { x: MARGIN + USABLE, y: top - rowH }, thickness: 0.5, color: rule });
      y = top - rowH;
    }

    drawRow(columns, { size: 7.8, bold: true, fill: headerFill, min: 24 });
    rows.forEach((r) => drawRow(r, { size: 8.6, bold: false, min: minRow }));
  }

  // ---- Letterhead ----
  page.drawText('SPRINGFIELD', { x: MARGIN, y, font: boldFont, size: 16, color: rgb(0.08, 0.08, 0.15) });
  y -= 15;
  page.drawText('REAL ESTATE', { x: MARGIN, y, font: boldFont, size: 9, color: muted });
  y -= 16;
  page.drawText(LEASE_LANDLORD, { x: MARGIN, y, font, size: 9, color: ink });
  y -= 12;
  page.drawText(LEASE_ADDRESS, { x: MARGIN, y, font, size: 9, color: muted });
  y -= 12;
  page.drawText('T +254721634528', { x: MARGIN, y, font, size: 9, color: muted });
  y -= 28;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.08, 0.08, 0.15) });
  y -= 26;

  page.drawText(agreement.title || 'RENTAL LEASE', { x: MARGIN, y, font: boldFont, size: 18, color: ink });
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

  // ---- Description (the lease preamble and operative terms) ----
  if (agreement.description && agreement.description.trim()) {
    const body = agreement.description.trim().replace(/^RENTAL LEASE\s*\n+/, '');
    drawWrapped(body, { size: 9.5, gap: 5 });
    y -= 10;
  }

  const items = [...(agreement.items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const clauses = items.filter((i) => (i.category ?? '') === CATEGORY_LEASE);
  const conditionItems = items.filter((i) => (i.category ?? '') !== CATEGORY_LEASE);

  // ---- Lease clauses, numbered as in the document ----
  if (clauses.length > 0) {
    heading('LEASE CLAUSES');
    drawWrapped('Clauses marked [X] were read and accepted by the Tenant.', { size: 8, color: muted, gap: 3 });
    y -= 6;
    for (const item of clauses) {
      const mark = checked.has(item.id) ? '[X]' : '[  ]';
      ensureSpace(40);
      drawWrapped(`${mark}  ${item.label.toUpperCase()}`, { size: 10, bold: true, gap: 3 });
      if (item.body_text) {
        drawWrapped(item.body_text, { size: 9, color: rgb(0.22, 0.22, 0.25), gap: 3.5, indent: 22, width: USABLE - 22 });
        y -= 6;
      }
    }
  }

  // ---- Appendix 1: Property Condition Check List ----
  if (conditionItems.length > 0) {
    y -= 8;
    heading('Appendix 1: Property Condition Check List', 12);
    const rooms = Array.from(new Set(conditionItems.map((i) => i.category ?? 'Property Condition')));
    for (const room of rooms) {
      const roomLabel = room.replace(/^Property Condition\s*-\s*/, '').toUpperCase();
      ensureSpace(70);
      y -= 4;
      page.drawText(roomLabel, { x: MARGIN, y, font: boldFont, size: 9.5, color: rgb(0.16, 0.3, 0.5) });
      y -= 12;
      const rows = conditionItems
        .filter((i) => (i.category ?? 'Property Condition') === room)
        .map((i) => [i.label, '', '', '', '']);
      drawTable(['', CONDITION_COLUMNS[0], CONDITION_COLUMNS[1], CONDITION_COLUMNS[2], CONDITION_COLUMNS[3]], rows, { rowHeight: 22 });
      y -= 14;
    }
  }

  // ---- Acknowledgement ----
  y -= 6;
  ensureSpace(60);
  drawWrapped(
    agreement.tenant_checks && agreement.tenant_checks.length > 0
      ? `The undersigned have read and understood this Agreement in the entirety. The Tenant acknowledged and submitted this Agreement on ${agreement.submitted_at ? new Date(agreement.submitted_at).toLocaleString('en-GB') : 'the date recorded in the system'}.`
      : 'The undersigned have read and understood this Agreement in the entirety. This Agreement has not yet been acknowledged/submitted by the Tenant.',
    { size: 9.5, gap: 4 }
  );

  // ---- Signature blocks ----
  y -= 18;
  ensureSpace(170);
  page.drawText('EXECUTION', { x: MARGIN, y, font: boldFont, size: 12, color: ink });
  y -= 28;

  const sigLine = (label: string) => {
    ensureSpace(60);
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

  stampFooters();
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
