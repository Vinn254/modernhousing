export default function TermsPage() {
    return (<main className="container" style={{ maxWidth: '800px' }}>
      <div className="card-admin-header">
        <div>
          <p className="heading">Terms and Conditions</p>
          <p className="subheading">Springfield Systems Property Management</p>
        </div>
      </div>

      <article className="card" style={{ marginTop: 24 }}>
        <div className="card-label">Terms of Service</div>
        
        <h3>1. Acceptance of Terms</h3>
        <p>By accessing Springfield Systems, you agree to these terms.</p>

        <h3>2. Services</h3>
        <p>We provide property management services including rent collection, utility billing, and tenant communication.</p>

        <h3>3. Payments</h3>
        <p>Rent and utility payments are to be made on agreed dates. Payments should be completed before the due date to avoid service interruption.</p>

        <h3>4. Water Billing</h3>
        <p>Water is billed at KES 150 per unit. Consumption calculated from meter readings. Bills are generated monthly.</p>

        <h3>5. Privacy</h3>
        <p>Your data is stored securely and used only for property management purposes.</p>

        <h3>6. Session Management</h3>
        <p>Sessions expire after 5 minutes of inactivity for security.</p>
      </article>
    </main>);
}
