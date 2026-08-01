import { NextResponse } from 'next/server';
import { getAllAdminUsers } from '../../../../lib/supabaseAdmin';
import { sendEmailBrevo } from '../../../../lib/brevo';
export async function POST(request) {
    try {
        const { email } = await request.json();
        if (!email) {
            return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
        }
        const users = await getAllAdminUsers();
        const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (user) {
            await sendEmailBrevo(user.email, 'Your Springfield Systems Email', `<p>You recently requested your login email reminder.</p><p>If you need to sign in, use this email address: <strong>${user.email}</strong></p>`);
        }
        return NextResponse.json({
            message: `If an account exists with this email, a reminder has been sent.`,
        });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to process request.' }, { status: 500 });
    }
}
