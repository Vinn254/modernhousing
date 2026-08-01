'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function TopRightLogout() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      supabase.auth.getUser().then(({ data }) => setUser(data.user));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!user) return null;

  return null;
}