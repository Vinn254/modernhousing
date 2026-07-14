import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function logAuditEvent(
  userId: string | null | undefined,
  userEmail: string | null | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any,
  request?: NextRequest
) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId ?? null,
      user_email: userEmail ?? null,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      details: details ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}