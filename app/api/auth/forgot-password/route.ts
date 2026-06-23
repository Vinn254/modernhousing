import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://modernhousing.vercel.app'}/reset-password`,
    });

    if (error) {
      return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    return NextResponse.json({ 
      message: 'If an account exists, a reset link has been sent.',
      success: true 
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to process request.' }, { status: 500 });
  }
}