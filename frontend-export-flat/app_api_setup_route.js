import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
export async function POST(request) {
    const body = await request.json();
    const { action, email, password, fullName, targetEmail, propertyId, userId } = body;
    if (action === 'create-super-admin') {
        const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError) {
            return NextResponse.json({ message: usersError.message }, { status: 500 });
        }
        const existingUser = usersData?.users.find((user) => user.email === email);
        if (existingUser) {
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName, role: 'super_admin' },
            });
            if (updateError) {
                return NextResponse.json({ message: updateError.message }, { status: 500 });
            }
            return NextResponse.json({ message: 'Super admin updated.', userId: existingUser.id }, { status: 200 });
        }
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: 'super_admin' },
        });
        if (error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'Super admin created.', userId: data.user?.id }, { status: 201 });
    }
    if (action === 'assign-properties-to-landlord') {
        const { data: users, error: usersErr } = await supabaseAdmin.auth.admin.listUsers();
        if (usersErr)
            return NextResponse.json({ message: usersErr.message }, { status: 500 });
        const { data: targetProfile } = await supabaseAdmin
            .from('profiles')
            .select('organization_id')
            .eq('email', targetEmail)
            .single();
        if (!targetProfile?.organization_id) {
            const { data: newOrg } = await supabaseAdmin
                .from('organizations')
                .insert({ name: `${targetEmail?.split('@')[0] ?? 'Property Manager'} Organization` })
                .select('id')
                .single();
            if (newOrg) {
                await supabaseAdmin
                    .from('profiles')
                    .update({ organization_id: newOrg.id })
                    .eq('email', targetEmail);
                return NextResponse.json({ message: `Organization created for ${targetEmail}.`, organizationId: newOrg.id });
            }
            return NextResponse.json({ message: 'Failed to create organization.' }, { status: 500 });
        }
        return NextResponse.json({ message: `Landlord already has organization.`, organizationId: targetProfile.organization_id });
    }
    if (action === 'assign-property-to-user') {
        // Assign a specific property to a user by setting created_by
        if (!propertyId || !userId) {
            return NextResponse.json({ message: 'propertyId and userId are required.' }, { status: 400 });
        }
        // Verify the property exists
        const { data: property, error: propErr } = await supabaseAdmin
            .from('properties')
            .select('id')
            .eq('id', propertyId)
            .single();
        if (propErr || !property) {
            return NextResponse.json({ message: 'Property not found.' }, { status: 404 });
        }
        // Set created_by on the property
        const { error } = await supabaseAdmin
            .from('properties')
            .update({ created_by: userId })
            .eq('id', propertyId);
        if (error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: `Property assigned to user.`, propertyId, userId });
    }
    if (action === 'setup-all-landlords') {
        const { data: profiles, error: profilesErr } = await supabaseAdmin
            .from('profiles')
            .select('id, user_id, email, organization_id')
            .eq('role', 'project_manager');
        if (profilesErr)
            return NextResponse.json({ message: profilesErr.message }, { status: 500 });
        for (const profile of profiles ?? []) {
            if (!profile.organization_id) {
                const { data: newOrg } = await supabaseAdmin
                    .from('organizations')
                    .insert({ name: `${profile.email?.split('@')[0] ?? 'Property Manager'} Organization` })
                    .select('id')
                    .single();
                if (newOrg) {
                    await supabaseAdmin
                        .from('profiles')
                        .update({ organization_id: newOrg.id })
                        .eq('id', profile.id);
                    // Also update auth user metadata for session consistency
                    if (profile.user_id) {
                        await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
                            user_metadata: { organization_id: newOrg.id }
                        });
                    }
                }
            }
        }
        // Orphaned properties remain unassigned - landlords only see properties they created
        return NextResponse.json({ message: 'All landlords set up with organizations. Orphaned properties remain unassigned.', count: profiles?.length ?? 0 });
    }
    return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
}
export async function GET() {
    const response = await supabaseAdmin.auth.admin.listUsers();
    return NextResponse.json({ users: response.data?.users ?? [] });
}
