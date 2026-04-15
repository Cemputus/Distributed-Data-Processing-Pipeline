import { useMemo, useState } from 'react'
import './AuditLogsPage.css'

export function AuditLogsPage({ items }) {
  const [query, setQuery] = useState('')
  const filteredItems = useMemo(
    () => items.filter((item) => `${item.username} ${item.action} ${item.outcome} ${item.details}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  )

  return (
    <section className="card audit-page">
      <div className="section-head">
        <h2>Audit Logs</h2>
        <input placeholder="Filter logs..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {filteredItems.length === 0 ? <div className="empty-state">No audit logs yet.</div> : (
        <table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Outcome</th><th>Details</th></tr></thead>
          <tbody>
            {filteredItems.map((item, idx) => (
              <tr key={`${item.timestamp}-${idx}`}>
                <td>{item.timestamp}</td><td>{item.username}</td><td>{item.action}</td><td><span className={`status-pill ${item.outcome || ''}`}>{item.outcome}</span></td><td>{item.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
