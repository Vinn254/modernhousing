# Springfield Systems

Apartment management system scaffold using Next.js and Supabase.

## Stack

- Next.js (App Router)
- TypeScript
- Supabase Auth + Postgres

## What is scaffolded

- PM signup flow (`/signup`)
- login flow (`/login`)
- dashboard shell (`/dashboard`)
- property creation form (`/properties`)
- tenant creation form (`/tenants`)
- payment creation form (`/payments`)
- Supabase server routes for registration, properties, tenants, payments
- database schema file at `db/schema.sql`

## Setup

1. Create a Supabase project.
2. Add the `auth.users` table from Supabase Auth.
3. Run `db/schema.sql` in Supabase SQL editor to create the core tables.
4. Set environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

5. Install dependencies:

```bash
npm install
```

6. Start development server:

```bash
npm run dev
```

## Next steps

- wire Supabase auth session handling for protected routes
- implement PM-only property listing and unit creation
- add agent assignment flow
- add admin panel for user status and role management
- build tenant record and payment history views

## Notes

- Agents must be created through the PM property/unit flow.
- Admin and Super Admin roles are designed for system-wide management and user control.
