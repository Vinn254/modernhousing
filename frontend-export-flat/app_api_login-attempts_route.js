import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
export async function GET(request) {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '';
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, count, error } = await supabaseAdmin
        .from('login_attempts')
        .select('*', { count: 'exact' })
        .eq('ip_address', ipAddress)
        .eq('success', false)
        .gte('attempted_at', oneHourAgo);
    const failedCount = count ?? 0;
    const isLocked = failedCount >= 5;
    return NextResponse.json({
        isLocked,
        failedAttempts: failedCount,
    });
}
export async function DELETE(request) {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '';
    // Clear failed attempts on successful login
    await supabaseAdmin
        .from('login_attempts')
        .delete()
        .eq('ip_address', ipAddress)
        .eq('success', false);
    return NextResponse.json({ cleared: true });
}
export async function POST(request) {
    const body = await request.json();
    const { email, success } = body;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '';
    await supabaseAdmin.from('login_attempts').insert({
        email,
        ip_address: ipAddress,
        success: success ?? false,
        attempted_at: new Date().toISOString(),
    });
    return NextResponse.json({ recorded: true });
}
