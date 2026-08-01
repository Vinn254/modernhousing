'use client';
import { useEffect, useState } from 'react';
export default function AgentComplaintsPage() {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    async function loadData() {
        setLoading(true);
        try {
            const storedPropertyId = localStorage.getItem('agentPropertyId') || '';
            const response = await fetch(`/api/comments?propertyId=${storedPropertyId}`);
            const result = await response.json();
            if (response.ok)
                setComments(result.comments ?? []);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { loadData(); }, []);
    return (<main className="container admin-no-hero">
      <div className="card-admin-header">
        <div><p className="heading">Tenant Complaints</p><p className="subheading">View house problems raised by tenants for your assigned property.</p></div>
      </div>

      <section className="bento-section">
        <div className="bento">
          <article className="card">
            <div className="card-label">Complaints</div>
            <h3 style={{ marginBottom: 16 }}>House Problems Raised</h3>
            {loading && <p className="landlord-muted">Loading complaints...</p>}
            {!loading && comments.length === 0 && <p className="landlord-empty">No complaints raised yet.</p>}
            {!loading && comments.length > 0 && (<div className="table-shell">
                <table className="landlord-table">
                  <thead><tr><th>Tenant</th><th>Complaint</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {comments.map(comment => (<tr key={comment.id}>
                        <td className="landlord-name">{comment.tenant}</td>
                        <td>{comment.message}</td>
                        <td><span className={`status-pill ${comment.status === 'open' ? 'status-pending' : 'status-active'}`}>{comment.status}</span></td>
                        <td>{comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ''}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
            {error && <p className="landlord-error">{error}</p>}
          </article>
        </div>
      </section>
    </main>);
}
