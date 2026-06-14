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
  role text not null check (role in ('super_admin', 'admin', 'project_manager', 'agent')),
  organization_id uuid references organizations(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
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
  created_at timestamp with time zone default now()
);

create index on properties (organization_id);
create index on units (property_id);
create index on tenants (unit_id);
create index on payments (tenant_id);
