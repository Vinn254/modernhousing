import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
async function createSuperAdmin() {
    const email = 'vin.oumaotieno@gmail.com';
    const password = '123456789';
    const fullName = 'Super Admin';
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) {
        console.error('Error listing users:', usersError.message);
        return;
    }
    if (usersData?.users.some((user) => user.email === email)) {
        console.log('Super admin already exists.');
        return;
    }
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: 'super_admin' },
    });
    if (error) {
        console.error('Error creating super admin:', error.message);
        return;
    }
    console.log('Super admin created:', data.user?.id);
}
createSuperAdmin();
