import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
    }

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'https://modernhousing.vercel.app'}/reset-password`;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('Supabase resetPasswordForEmail error:', {
        message: error.message,
        status: error.status,
        email,
        redirectTo,
      });
      return NextResponse.json(
        { message: 'Unable to send reset link. Please try again later.' },
        { status: 500 }
      );
    }

    if (supabaseAdmin) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const user = usersData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        const isSuperAdmin = user?.user_metadata?.role === 'super_admin' || user?.email === 'vin.oumaotieno@gmail.com';
        console.log('Forgot password debug:', {
          email,
          userExists: !!user,
          emailConfirmed: user?.email_confirmed_at ?? null,
          isSuperAdmin,
          sent: !isSuperAdmin,
          redirectTo,
        });

        if (isSuperAdmin) {
          return NextResponse.json(
            { message: 'Password reset is not available for the super admin account.' },
            { status: 403 }
          );
        }
      } catch (adminError) {
        console.error('Admin user lookup error:', adminError);
      }
    }

    return NextResponse.json({
      message: 'If an account exists, a reset link has been sent.',
      success: true,
    });
  } catch (error: any) {
    console.error('Forgot password route error:', error);
    return NextResponse.json({ message: error.message ?? 'Unable to process request.' }, { status: 500 });
  }
}
