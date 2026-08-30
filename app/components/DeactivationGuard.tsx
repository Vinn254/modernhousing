'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export function useDeactivationGuard() {
  const router = useRouter();
  const [isDeactivated, setIsDeactivated] = useState(false);
  const [deactivationInfo, setDeactivationInfo] = useState<{ landlordName: string; deactivatedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Only check for project_manager (landlord) role
        const role = user.user_metadata?.role;
        if (role !== 'project_manager' && role !== 'admin') {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('status, full_name, deactivated_at, approval_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile && (profile.status === 'inactive' || profile.approval_status === 'deactivated')) {
          setIsDeactivated(true);
          setDeactivationInfo({
            landlordName: profile.full_name || user.email || 'Landlord',
            deactivatedAt: profile.deactivated_at || new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Deactivation check failed:', err);
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return { isDeactivated, deactivationInfo, loading, handleLogout };
}

interface DeactivationPopupProps {
  landlordName?: string;
  onLogout: () => void;
}

export function DeactivationPopup({ landlordName, onLogout }: DeactivationPopupProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: '#111827' }}>
          Subscription Expired
        </h2>
        <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: 15 }}>
          {landlordName ? `Hello ${landlordName}, ` : ''}Your subscription has expired and your access has been deactivated.
        </p>
        <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 15 }}>
          Please contact the super admin or renew your subscription to regain access to the platform.
        </p>
        <button
          onClick={onLogout}
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 32px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Sign Out
        </button>
        <p style={{ margin: '20px 0 0', color: '#9ca3af', fontSize: 13 }}>
          Need help? Contact support at <a href="mailto:support@springfield-systems.com" style={{ color: '#2563eb', textDecoration: 'none' }}>support@springfield-systems.com</a>
        </p>
      </div>
    </div>
  );
}
