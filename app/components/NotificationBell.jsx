'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function NotificationBell({ role, userEmail, tenantId, agentId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const POLL_INTERVAL = 30000;

  useEffect(() => {
    let isActive = true;

    async function fetchNotifications() {
      if (!isActive) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;

        const recipient = role === 'tenant' ? 'tenant' : role === 'agent' ? 'agent' : 'project_manager';
        const params = new URLSearchParams({ recipient });
        if (role === 'tenant' && tenantId) params.set('tenantId', tenantId);
        if (role === 'landlord' && userEmail) params.set('adminEmail', userEmail);
        if (role === 'agent' && agentId) params.set('agentId', agentId);

        const response = await fetch('/api/notifications?' + params.toString(), { headers });

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const result = await response.json();
        const items = (result.notifications || []).map(function (n) {
          return {
            id: n.id,
            message: n.message || n.description || '',
            created_at: n.created_at || new Date().toISOString(),
            status: n.status || 'sent',
            type: n.type || (n.transaction_type === 'notification' ? 'message' : 'overdue'),
            recipient: n.recipient || recipient,
            tenant: n.tenants ? { full_name: n.tenants.full_name || '', email: n.tenants.email || '' } : undefined
          };
        });

        const sorted = items.sort(function (a, b) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setNotifications(sorted.slice(0, 10));
        setUnreadCount(sorted.filter(function (n) { return n.status !== 'read'; }).length);
        setLoading(false);
      } catch (e) {
        if (isActive) setLoading(false);
      }
    }

    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, POLL_INTERVAL);

    return function () {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [role, userEmail, tenantId, agentId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return function () { return document.removeEventListener('mousedown', handleClickOutside); };
  }, []);

  async function markAllAsRead() {
    for (const notif of notifications) {
      if (notif.status !== 'read') {
        await fetch('/api/notifications?id=' + notif.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'read' })
        });
      }
    }
    setNotifications(function (prev) { return prev.map(function (n) { return Object.assign({}, n, { status: 'read' }); }); });
    setUnreadCount(0);
  }

  const bellColor = unreadCount > 0 ? 'var(--accent)' : 'var(--ink-3)';
  const accentColor = unreadCount > 0 ? 'var(--accent-soft)' : 'transparent';

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef}>
      <button
        className="notification-bell"
        onClick={function () { return setDropdownOpen(!dropdownOpen); }}
        aria-label={'Notifications (' + unreadCount + ')'}
        style={{
          position: 'relative',
          background: accentColor,
          border: 'none',
          borderRadius: '8px',
          padding: '8px',
          cursor: 'pointer',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={bellColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="notification-badge"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'var(--accent)',
              color: 'white',
              fontSize: '10px',
              fontWeight: '700',
              minWidth: '18px',
              height: '18px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div
          className="notification-dropdown"
          style={{
            position: 'absolute',
            top: '52px',
            right: '0',
            width: '360px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '420px',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            boxShadow: '0 16px 44px rgba(0,0,0,0.15)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-alt, #f8fafc)'
            }}
          >
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
              {role === 'tenant' ? 'My Notifications' : 'Overdue Alerts'}
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: '13px' }}>
                Loading notifications…
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: '13px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 8px', opacity: 0.5 }}>
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <div>No notifications yet.</div>
              </div>
            )}

            {!loading && notifications.map(function (notif) {
              const isUnread = notif.status !== 'read';
              const isOverdue = notif.type === 'overdue' || notif.type === 'long_overdue';
              const timeAgo = formatTimeAgo(notif.created_at);

              let typeLabel = notif.type || 'message';
              let typeColor = 'var(--ink-3)';
              if (notif.type === 'overdue') { typeLabel = '⚠️ Overdue'; typeColor = '#dc2626'; }
              else if (notif.type === 'rent_reminder') { typeLabel = '🔔 Reminder'; typeColor = '#f59e0b'; }
              else if (notif.type === 'reply') { typeLabel = '💬 Reply'; typeColor = 'var(--accent)'; }
              else if (notif.type === 'long_overdue') { typeLabel = '🚨 Long Overdue'; typeColor = '#dc2626'; }

              return (
                <div
                  key={notif.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--line-soft)',
                    background: isUnread ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: typeColor, fontSize: '12px' }}>{typeLabel}</span>
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: isUnread ? 'var(--ink)' : 'var(--ink-3)' }}>
                    {truncateMessage(notif.message, 120)}
                  </p>
                  {notif.tenant && (
                    <div style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '2px 0' }}>
                      {notif.tenant.full_name}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{timeAgo}</div>
                </div>
              );
            })}
          </div>

          {notifications.length > 0 && (
            <div style={{ padding: '8px 16px', textAlign: 'center', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <a
                href={role === 'tenant' ? '/tenant/notifications' : '/admin/communications'}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  padding: '8px 0'
                }}
                onClick={function () { return setDropdownOpen(false); }}
              >
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function truncateMessage(msg, maxLen) {
  if (msg.length <= maxLen) return msg;
  return msg.slice(0, maxLen) + '…';
}

function formatTimeAgo(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return date.toLocaleDateString();
  } catch (e) {
    return '';
  }
}
