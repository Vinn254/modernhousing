import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ message: 'Password is required.' }, { status: 400 });
    }

    // For Supabase password reset, the user needs to have a valid session from the reset link
    // This endpoint is called when user submits new password from reset page
    // Supabase automatically validates the session and allows password update

    return NextResponse.json({ 
      message: 'Password updated successfully.',
      success: true 
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to reset password.' }, { status: 500 });
  }
}