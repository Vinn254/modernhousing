-- Supabase schema for Springfield Systems

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  details text,
  created_at timestamp with time zone default now()
);

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('super_admin', 'admin', 'project_manager', 'agent')),
  organization_id uuid references organizations(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  created_at timestamp with time zone default now()
);

create table properties (
   id uuid primary key default uuid_generate_v4(),
   organization_id uuid references organizations(id) on delete cascade,
   name text not null,
   address text not null,
   size text,
   amenities text,
   ownership_info text,
   created_at timestamp with time zone default now()
);

create table units (
   id uuid primary key default uuid_generate_v4(),
   property_id uuid references properties(id) on delete cascade,
   unit_number text not null,
   size text,
   rent_amount numeric(12,2) not null default 0,
   occupancy_status text not null default 'vacant' check (occupancy_status in ('vacant', 'occupied')),
   agent_email text,
   unit_type text check (unit_type in ('single-room', 'bedsitter', 'one-bedroom', 'two-bedroom', 'three-bedroom') or unit_type is null),
   created_at timestamp with time zone default now()
);

create table tenants (
   id uuid primary key default uuid_generate_v4(),
   unit_id uuid references units(id) on delete cascade,
   full_name text not null,
   email text not null,
   phone text,
   lease_start date not null,
   lease_end date not null,
   deposit_amount numeric(12,2) not null default 0,
   picture_url text,
   created_at timestamp with time zone default now()
);

create table tenant_documents (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  document_type text not null,
  file_path text,
  file_name text,
  created_at timestamp with time zone default now()
);

create table payments (
   id uuid primary key default uuid_generate_v4(),
   tenant_id uuid references tenants(id) on delete cascade,
   description text not null,
   transaction_type text not null,
   amount numeric(12,2) not null default 0,
   balance_remaining numeric(12,2) not null default 0,
   paid_at timestamp with time zone,
   month_due text,
   due_amount numeric(12,2),
   penalty_fee numeric(12,2) default 0,
   transaction_number text,
   transaction_code text,
   created_at timestamp with time zone default now()
);

create table tenant_agreements (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  content text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid,
  admin_name text not null,
  email text not null,
  plan text not null check (plan in ('monthly', 'quarterly', 'yearly')),
  amount numeric(12,2) not null default 0,
  status text not null default 'paid' check (status in ('paid', 'pending', 'overdue', 'expired', 'active')),
  start_date date,
  expiry_date date,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table notifications (
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

create table comments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  recipient_role text not null,
  recipient_id uuid,
  message text not null,
  status text not null default 'open',
  created_at timestamp with time zone default now()
);

create index on properties (organization_id);
create index on units (property_id);
create index on tenants (unit_id);
create index on payments (tenant_id);
create index on notifications (recipient);
create index on notifications (admin_id);
create index on notifications (created_at);
