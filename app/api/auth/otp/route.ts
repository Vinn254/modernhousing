import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, generateOTP } from '../../../../lib/emailService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, action } = body;

    if (!email || !code || !action) {
      return NextResponse.json({ message: 'Email, code, and action are required.' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ message: 'Profile not found.' }, { status: 404 });
    }

    if (profile.otp_code !== code) {
      return NextResponse.json({ message: 'Invalid OTP code.' }, { status: 400 });
    }

    if (profile.otp_expires_at && new Date(profile.otp_expires_at) < new Date()) {
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    if (action === 'login') {
      await supabaseAdmin
        .from('profiles')
        .update({
          otp_code: null,
          otp_expires_at: null,
        })
        .eq('id', profile.id);

      return NextResponse.json({ message: 'Login successful via OTP.', userId: profile.user_id });
    }

    return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to process OTP.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const action = request.nextUrl.searchParams.get('action');

  if (!email || !action) {
    return NextResponse.json({ message: 'Email and action are required.' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ message: 'Profile not found.' }, { status: 404 });
  }

  if (action === 'resend') {
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('profiles')
      .update({ otp_code: otp, otp_expires_at: otpExpiresAt })
      .eq('id', profile.id);

    const html = `
      <h2>Your One-Time Password</h2>
      <p>Use this code to complete your login:</p>
      <h1 style="letter-spacing: 6px;">${otp}</h1>
      <p>This code will expire in 15 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `;

    await sendEmail({
      to: email,
      subject: 'Your Springfield Systems One-Time Password',
      html,
      text: `Your OTP is ${otp}. It will expire in 15 minutes.`,
    });

    return NextResponse.json({ message: 'OTP resent successfully.' });
  }

  return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
}
