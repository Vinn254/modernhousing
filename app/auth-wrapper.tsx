'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppHeader from './components/AppHeader';
import SessionTimeout from './components/SessionTimeout';
import { supabase } from '../lib/supabaseClient';

function resolveRole(currentUser: any): 'super_admin' | 'admin' | 'landlord' | 'agent' | 'tenant' | 'user' {
  if (currentUser?.email === 'vin.oumaotieno@gmail.com') return 'super_admin';
  const metadataRole = currentUser?.user_metadata?.role;
  if (metadataRole === 'project_manager') return 'landlord';
  if (metadataRole === 'admin') return 'landlord';
  if (metadataRole === 'super_admin') return 'super_admin';
  if (metadataRole === 'agent') return 'agent';
  if (metadataRole === 'tenant') return 'tenant';
  return 'user';
}

function isUnapprovedLandlord(role: string, profile: any): boolean {
  if (role !== 'landlord') return false;
  if (!profile) return true;
  const approvalStatus = profile.approval_status;
  const profileStatus = profile.status;
  if (approvalStatus === 'pending' || approvalStatus === 'rejected') return true;
  if (profileStatus === 'pending' || profileStatus === 'inactive') return true;
  if (approvalStatus === null || approvalStatus === undefined) {
    return profileStatus === 'pending';
  }
  return false;
}

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      if (redirectingRef.current) return;

      setReady(false);
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;

      if (!currentUser) {
        if (active) {
          setRestricted(false);
          setReady(true);
        }
        return;
      }

      const role = resolveRole(currentUser);
      const authHeader = session?.access_token;
      let profile: any = null;

      if (authHeader) {
        try {
          const response = await fetch('/api/profile', {
            headers: { Authorization: `Bearer ${authHeader}` },
            cache: 'no-store',
          });
          if (response.ok) {
            const result = await response.json().catch(() => ({}));
            profile = result.profile ?? null;
          }
        } catch {
          profile = null;
        }
      }

      const shouldRestrict = isUnapprovedLandlord(role, profile);

      const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/profile'];
      const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith('/tenant/register');
      const shouldRedirect = shouldRestrict && !isPublicPath;

      if (active) {
        setRestricted(Boolean(shouldRestrict));
        setReady(true);
      }

      if (shouldRedirect && pathname !== '/profile' && !redirectingRef.current) {
        redirectingRef.current = true;
        router.replace('/profile');
      }
    }

    void checkAccess();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      redirectingRef.current = false;
      void checkAccess();
    });

    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!ready) return null;
  if (restricted && pathname !== '/profile') return null;

  return (
    <div className="page-wrapper">
      <AppHeader />
      <SessionTimeout />
      {children}
    </div>
  );
}