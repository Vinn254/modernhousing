import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

export interface AdminUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  email_confirmed_at?: string | null;
  created_at?: string;
}

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);
  headers.set('apikey', serviceRoleKey);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let body: any = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const message = body?.message || body?.error || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return body as T;
}

export async function listAdminUsers(page = 1, perPage = 100): Promise<AdminUser[]> {
  const data = await adminRequest<any>(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`);
  return data?.users ?? [];
}

export async function getAllAdminUsers(): Promise<AdminUser[]> {
  const perPage = 100;
  let page = 1;
  const users: AdminUser[] = [];

  while (true) {
    const pageUsers = await listAdminUsers(page, perPage);
    users.push(...pageUsers);
    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function getUserByEmail(email: string): Promise<AdminUser | null> {
  const users = await getAllAdminUsers();
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'super_admin' | 'agent' | 'project_manager' | 'tenant';
}): Promise<{ user: AdminUser; error: Error | null }> {
  const user = await adminRequest<any>('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        role: input.role,
      },
    }),
  });

  return { user: user?.user ?? user, error: null };
}

export async function updateAdminUser(input: {
  userId: string;
  fullName?: string;
  role?: 'admin' | 'super_admin' | 'agent' | 'project_manager' | 'tenant';
  password?: string;
}) {
  const body: Record<string, any> = {};

  if (input.fullName) {
    body.user_metadata = {
      full_name: input.fullName,
      role: input.role,
    };
  } else if (input.role) {
    body.user_metadata = { role: input.role };
  }

  if (input.password) {
    body.password = input.password;
  }

  return adminRequest<any>(`/auth/v1/admin/users/${encodeURIComponent(input.userId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function jsonResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export function isMissingTableError(error: any, tableName: string) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes(`public.${tableName}`) && normalizedMessage.includes('could not find');
}

export function requestError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return NextResponse.json({ message }, { status: 500 });
}

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function requireJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON request body.');
  }
}
