import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  try {
    const { password, accessToken } = await request.json();

    if (!password) {
      return NextResponse.json({ message: 'Password is required.' }, { status: 400 });
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.json({ message: error.message ?? 'Unable to reset password.' }, { status: 400 });
    }

    return NextResponse.json({ 
      message: 'Password updated successfully.',
      success: true 
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to reset password.' }, { status: 500 });
  }
}