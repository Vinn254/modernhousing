export type UserRole = 'super_admin' | 'admin' | 'project_manager' | 'agent';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  details: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  size: string;
  amenities: string;
  ownership_info: string;
  created_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  size: string;
  rent_amount: number;
  occupancy_status: 'vacant' | 'occupied';
  agent_email: string | null;
  created_at: string;
}

export interface Tenant {
  id: string;
  unit_id: string;
  full_name: string;
  email: string;
  phone: string;
  lease_start: string;
  lease_end: string;
  deposit_amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  description: string;
  transaction_type: string;
  amount: number;
  balance_remaining: number;
  paid_at: string | null;
  created_at: string;
}
