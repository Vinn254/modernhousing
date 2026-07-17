'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function SessionTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    await supabase.auth.signOut();
    router.replace('/login');
  }, [router]);

  const resetTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    setShowWarning(false);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      logoutTimerRef.current = setTimeout(async () => {
        await handleLogout();
      }, 60000);
    }, 5 * 60 * 1000); // 5 minutes
  }, [handleLogout]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimers));

    resetTimers();

    return () => {
      events.forEach(event => document.removeEventListener(event, resetTimers));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      subscription.unsubscribe();
    };
  }, [resetTimers]);

  if (!showWarning) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: '#fef3c7',
      color: '#92400e',
      padding: '16px',
      textAlign: 'center',
      zIndex: 9999,
      borderBottom: '1px solid #f59e0b'
    }}>
      Session expires in 1 minute due to inactivity. 
      <button onClick={() => {
        setShowWarning(false);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        warningTimerRef.current = setTimeout(() => {
          setShowWarning(true);
          logoutTimerRef.current = setTimeout(async () => {
            await handleLogout();
          }, 60000);
        }, 5 * 60 * 1000);
      }} style={{
        marginLeft: 16,
        background: '#f59e0b',
        color: '#fff',
        border: 'none',
        padding: '6px 12px',
        borderRadius: 4,
        cursor: 'pointer'
      }}>
        Stay Logged In
      </button>
    </div>
  );
}