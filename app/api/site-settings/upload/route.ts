import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BUCKET = 'site-media';
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif'];
const MAX_BYTES = 8 * 1024 * 1024;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase server environment variables');
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function requireSuperAdmin(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false as const, status: 401, message: 'Authentication required.' };
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false as const, status: 401, message: 'Invalid or expired session.' };
  if (data.user.user_metadata?.role !== 'super_admin') return { ok: false as const, status: 403, message: 'Only a super admin can upload images.' };
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

    const formData = await request.formData();
    const file = formData.get('file');
    const slot = String(formData.get('slot') ?? 'hero');

    if (!(file instanceof File)) return NextResponse.json({ message: 'No file provided.' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ message: 'Unsupported image type. Use PNG, JPG, WEBP or AVIF.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ message: 'Image is too large (max 8 MB).' }, { status: 400 });

    const safeSlot = slot === 'login' ? 'login' : 'hero';
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `backgrounds/${safeSlot}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getAdminClient();

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ message: 'Image uploaded.', url: data.publicUrl });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to upload image.' }, { status: 500 });
  }
}
