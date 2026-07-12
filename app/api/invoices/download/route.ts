import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function generatePDFBuffer(invoice: any, tenant: any, balance: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isPositive = balance > 0;
  const balanceText = isPositive ? `Owes KES ${Math.abs(balance).toLocaleString()}` : `Credit KES ${Math.abs(balance).toLocaleString()}`;
  const balanceColor = isPositive ? rgb(0.86, 0.15, 0.15) : rgb(0.06, 0.73, 0.51); // red or green

  const drawText = (text: string, x: number, y: number, options: any = {}) => {
    page.drawText(text, { x, y, font: options.bold ? boldFont : font, size: options.size || 12, color: options.color || rgb(0, 0, 0) });
  };

  let y = 750;

  // Header
  drawText('Springfield Systems', 150, y, { size: 24, bold: true, color: rgb(0.07, 0.09, 0.16) });
  y -= 30;
  drawText('INNTIVE Invoice', 200, y, { size: 16, color: rgb(0.42, 0.45, 0.49) });
  y -= 60;

  // Labels
  const labels = ['Tenant:', 'Property:', 'Month:', 'Description:', 'Amount Due:', 'Due Date:', 'Current Balance:'];
  const values = [
    tenant.full_name,
    tenant.units?.properties?.name || '-',
    invoice.month_due || '-',
    invoice.description || '-',
    `KES ${(Number(invoice.amount || 0)).toLocaleString()}`,
    invoice.due_date || '-',
    balanceText
  ];

  labels.forEach((label, i) => {
    drawText(label, 60, y, { bold: true, color: rgb(0.22, 0.25, 0.29) });
    page.drawText(values[i], { x: 200, y, font: i === labels.length - 1 ? boldFont : font, size: 12, color: i === labels.length - 1 ? balanceColor : rgb(0, 0, 0) });
    y -= 30;
  });

  return Buffer.from(await pdfDoc.save());
}

export async function GET(request: NextRequest) {
  try {
    const invoiceId = request.nextUrl.searchParams.get('invoiceId');
    if (!invoiceId) return NextResponse.json({ message: 'Invoice ID is required.' }, { status: 400 });

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*, tenants(full_name, email, phone, units(property_id, unit_number, properties(name)))')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 });
    }

    const tenant = invoice.tenants;
    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found.' }, { status: 404 });
    }

    // Calculate running balance (sum of all bill balances for this tenant)
    let balance = 0;
    const { data: tenantBills } = await supabaseAdmin
      .from('bills')
      .select('balance')
      .eq('tenant_id', invoice.tenant_id);
    if (tenantBills) {
      balance = tenantBills.reduce((sum: number, b: any) => sum + (b.balance || 0), 0);
    }

    // Generate PDF
    const pdfBuffer = await generatePDFBuffer(invoice, tenant, balance);

    const fileName = `invoice-${invoiceId}.pdf`;
    const filePath = `invoices/${fileName}`;

    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, pdfBuffer, { 
        contentType: 'application/pdf',
        upsert: true 
      });

    if (storageError) {
      throw storageError;
    }

    const { data: publicUrl } = supabaseAdmin.storage.from('documents').getPublicUrl(storageData.path);

    // Update invoice with file_path
    await supabaseAdmin.from('invoices').update({ file_path: publicUrl.publicUrl }).eq('id', invoiceId);

    return NextResponse.json({ downloadUrl: publicUrl.publicUrl });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to generate invoice.' }, { status: 500 });
  }
}