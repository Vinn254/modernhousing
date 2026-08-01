'use client';

import '../globals.css';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const LANDLORD_PROFILE_PATH = '/profile';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkLandlord = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const userRole = user.user_metadata?.role;
      const isLandlord = userRole === 'project_manager';
      const isSuperAdmin = user.email === 'vin.oumaotieno@gmail.com';
      if (!isLandlord && !isSuperAdmin) {
        router.push('/');
        return;
      }

      if (isLandlord) {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
          router.push('/login');
          return;
        }

        const response = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });

        const result = await response.json().catch(() => ({}));
        const approvalStatus = result.profile?.approval_status;
        const isApproved = approvalStatus === 'approved' || approvalStatus === null || approvalStatus === undefined;

        if (!isApproved && pathname !== LANDLORD_PROFILE_PATH) {
          router.replace(LANDLORD_PROFILE_PATH);
        }
      }
    };
    checkLandlord();
  }, [router, pathname]);

  return <>{children}</>;
}