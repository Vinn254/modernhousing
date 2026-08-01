'use client';

import '../globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

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
      }
    };
    checkLandlord();
  }, [router]);

  return <>{children}</>;
}