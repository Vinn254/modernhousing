-- Ensure notifications table exists for landlord overdue notification visibility
-- Landlords see overdue notifications sent to their tenants via admin_email filtering
-- in NotificationBell and Communications page

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  agent_id uuid,
  recipient text not null default 'tenant' check (recipient in ('tenant', 'landlord', 'project_manager')),
  admin_id uuid,
  admin_name text,
  admin_email text,
  type text not null default 'overdue',
  message text not null,
  status text not null default 'sent',
  created_at timestamp with time zone default now()
);

create index if not exists notifications_recipient_idx on notifications (recipient);
create index if not exists notifications_admin_id_idx on notifications (admin_id);
create index if not exists notifications_created_at_idx on notifications (created_at);
create index if not exists notifications_admin_email_idx on notifications (admin_email);
