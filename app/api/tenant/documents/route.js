import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers, isMissingTableError } from '../../../../lib/supabaseAdmin';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
async function getTenantId(userId) {
    const users = await getAllAdminUsers();
    const user = users.find((u) => u.id === userId);
    return user?.user_metadata?.tenant_id ?? null;
}
async function getTenantIdByEmail(email) {
    const { data: tenants } = await supabaseAdmin.from('tenants').select('id').eq('email', email).limit(1);
    return tenants && tenants.length > 0 ? tenants[0].id : null;
}
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
export async function GET(request) {
    try {
        const userId = request.nextUrl.searchParams.get('userId');
        const email = request.nextUrl.searchParams.get('email');
        let tenantId = null;
        if (userId)
            tenantId = await getTenantId(userId);
        else if (email)
            tenantId = await getTenantIdByEmail(email);
        if (!tenantId) {
            return NextResponse.json({ documents: [], message: 'Tenant not found.' });
        }
        const { data, error } = await supabaseAdmin
            .from('tenant_documents')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
        if (error && !isMissingTableError(error, 'tenant_documents'))
            throw error;
        return NextResponse.json({ documents: data ?? [] });
    }
    catch (error) {
        return NextResponse.json({ documents: [], message: error.message ?? 'Unable to load documents.' }, { status: 500 });
    }
}
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const tenantId = formData.get('tenantId');
        const documentType = formData.get('documentType') || 'other';
        if (!file || !tenantId) {
            return NextResponse.json({ message: 'File and tenant ID are required.' }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${tenantId}/${documentType}/${generateId()}-${file.name}`;
        const filePath = `tenant-documents/${fileName}`;
        const { data: storageData, error: storageError } = await supabaseAdmin.storage
            .from('documents')
            .upload(filePath, buffer, { contentType: file.type });
        if (storageError)
            throw storageError;
        const { data: docData, error: docError } = await supabaseAdmin
            .from('tenant_documents')
            .insert({
            tenant_id: tenantId,
            document_type: documentType,
            file_path: storageData.path,
            file_name: file.name,
        })
            .select()
            .single();
        if (docError && !isMissingTableError(docError, 'tenant_documents'))
            throw docError;
        if (documentType === 'tenant_photo' && docData) {
            const { data: publicUrl } = supabaseAdmin.storage.from('documents').getPublicUrl(storageData.path);
            await supabaseAdmin.from('tenants').update({ picture_url: publicUrl.publicUrl }).eq('id', tenantId);
        }
        return NextResponse.json({ message: 'Document uploaded.', document: docData ?? { path: storageData.path } });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to upload document.' }, { status: 500 });
    }
}
