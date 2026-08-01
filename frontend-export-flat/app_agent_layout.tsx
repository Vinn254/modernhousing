'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const checkAgent = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const userRole = user.user_metadata?.role;
      if (userRole !== 'agent') {
        router.push('/');
        return;
      }
    };
    checkAgent();
  }, [router]);

  return <>{children}</>;
}