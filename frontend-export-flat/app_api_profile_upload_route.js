import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const userId = formData.get('userId');
        if (!file || !userId) {
            return NextResponse.json({ message: 'File and userId are required.' }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `profile-${generateId()}-${file.name}`;
        const filePath = `profiles/${fileName}`;
        const { data: storageData, error: storageError } = await supabaseAdmin.storage
            .from('documents')
            .upload(filePath, buffer, { contentType: file.type });
        if (storageError)
            throw storageError;
        const { data: publicUrl } = supabaseAdmin.storage.from('documents').getPublicUrl(storageData.path);
        // Get user email from auth to update tenants table
        const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId);
        const userEmail = user?.user?.email;
        // Update profiles table (upsert to create if missing)
        const { data: existingProfile } = await supabaseAdmin.from('profiles').select('user_id').eq('user_id', userId).single();
        if (existingProfile) {
            await supabaseAdmin.from('profiles').update({ picture_url: publicUrl.publicUrl }).eq('user_id', userId);
        }
        else if (userEmail) {
            await supabaseAdmin.from('profiles').insert({ user_id: userId, email: userEmail, full_name: user?.user?.user_metadata?.full_name || '', picture_url: publicUrl.publicUrl });
        }
        // Also update tenants table by email
        if (userEmail) {
            await supabaseAdmin.from('tenants').update({ picture_url: publicUrl.publicUrl }).eq('email', userEmail);
        }
        return NextResponse.json({ message: 'Profile photo uploaded.', pictureUrl: publicUrl.publicUrl });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to upload profile photo.' }, { status: 500 });
    }
}
