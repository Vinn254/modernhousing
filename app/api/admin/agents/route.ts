import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers } from '../../../../lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    const url = new URL(request.url);
    const landlordId = url.searchParams.get('landlordId');

    const [users, profilesResult, landlordProfilesResult] = await Promise.all([
      getAllAdminUsers(),
      supabaseAdmin.from('profiles').select('*').eq('role', 'agent'),
      supabaseAdmin.from('profiles').select('*').eq('role', 'project_manager'),
    ]);

    if (profilesResult.error) {
      return NextResponse.json({ message: `Profiles error: ${profilesResult.error.message}`, error: profilesResult.error }, { status: profilesResult.error.code === 'PGRST301' || profilesResult.error.message?.includes('permission') ? 403 : 500 });
    }
    if (landlordProfilesResult.error) {
      return NextResponse.json({ message: `Landlord profiles error: ${landlordProfilesResult.error.message}`, error: landlordProfilesResult.error }, { status: landlordProfilesResult.error.code === 'PGRST301' || landlordProfilesResult.error.message?.includes('permission') ? 403 : 500 });
    }

    const profiles = (profilesResult.data ?? []) as any[];
    const landlordProfiles = (landlordProfilesResult.data ?? []) as any[];
    const landlordById = new Map(landlordProfiles.map((profile: any) => [profile.user_id, profile]));
    const usersById = new Map(users.map((user: any) => [user.id, user]));

    let agents = profiles.map((profile: any) => {
      const user = usersById.get(profile.user_id);
      const landlord = landlordById.get(user?.user_metadata?.landlord_id || '');
      return {
        id: profile.user_id,
        name: user?.user_metadata?.full_name || profile.full_name,
        email: profile.email,
        phone: profile.phone,
        property_name: user?.user_metadata?.property_name || '',
        property_id: user?.user_metadata?.property_id || '',
        status: user?.user_metadata?.agent_status || profile.status || 'active',
        landlord: landlord?.full_name || 'Unknown landlord',
        landlord_email: landlord?.email || '',
        created_at: profile.created_at,
      };
    });

    if (landlordId) {
      agents = agents.filter((agent: any) => agent.landlord_email === landlordId || agent.property_id === landlordId);
    }

    return NextResponse.json({ agents });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Internal server error', error: String(error) }, { status: 500 });
  }
}