import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers } from '../../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('userId');

    if (!file || !userId) {
      return NextResponse.json({ message: 'File and userId are required.' }, { status: 400 });
    }

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    const fileName = `profile-${generateId()}-${(file as File).name}`;
    const filePath = `profiles/${fileName}`;

    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, buffer, { contentType: (file as File).type });

    if (storageError) throw storageError;

const { data: publicUrl } = supabaseAdmin.storage.from('documents').getPublicUrl(storageData.path);

    // Update both profiles table and tenants table for picture
    await supabaseAdmin.from('profiles').update({ picture_url: publicUrl.publicUrl }).eq('user_id', userId as string);
    
    // Also update tenants table if tenant_id is available
    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('user_id', userId as string).single();
    if (profile?.tenant_id) {
      await supabaseAdmin.from('tenants').update({ picture_url: publicUrl.publicUrl }).eq('id', profile.tenant_id);
    }
    
    return NextResponse.json({ message: 'Profile photo uploaded.', pictureUrl: publicUrl.publicUrl });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to upload profile photo.' }, { status: 500 });
  }
}