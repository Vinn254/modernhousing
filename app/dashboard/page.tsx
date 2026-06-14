import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="container">
      <div className="card" style={{ marginBottom: 24 }}>
        <header className="header">
          <div>
            <p className="heading">Dashboard</p>
            <p className="subheading">Property Management Portal</p>
          </div>
        </header>
      </div>

      <div className="grid grid-3">
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--dark-blue-accent)', marginTop: 0, marginBottom: 12 }}>Properties</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Manage properties, units, and agent assignments.</p>
          <Link href="/properties" style={{ color: 'var(--accent)', fontWeight: 600 }}>Go to properties →</Link>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--dark-blue-accent)', marginTop: 0, marginBottom: 12 }}>Tenants</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Track tenants, leases, and contact details by unit.</p>
          <Link href="/tenants" style={{ color: 'var(--accent)', fontWeight: 600 }}>Go to tenants →</Link>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--dark-blue-accent)', marginTop: 0, marginBottom: 12 }}>Payments</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Register payments, balances, and overdue settlements.</p>
          <Link href="/payments" style={{ color: 'var(--accent)', fontWeight: 600 }}>Go to payments →</Link>
        </div>
      </div>
    </main>
  );
}