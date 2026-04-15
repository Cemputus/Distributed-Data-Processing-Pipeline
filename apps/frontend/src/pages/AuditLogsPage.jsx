import { useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './AuditLogsPage.css'

export function AuditLogsPage({ items }) {
  const [query, setQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(20)
  const filteredItems = useMemo(
    () => items.filter((item) => `${item.username} ${item.action} ${item.outcome} ${item.details}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  )
  const displayedItems = useMemo(() => sliceByRowLimit(filteredItems, rowLimit), [filteredItems, rowLimit])

  return (
    <section className="card audit-page">
      <div className="section-head">
        <h2>Audit Logs</h2>
        <div className="section-head-controls">
          <input placeholder="Filter logs..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <RowsPerPageSelect value={rowLimit} onChange={setRowLimit} id="audit-logs-rows" />
        </div>
      </div>
      {filteredItems.length === 0 ? <div className="empty-state">No audit logs yet.</div> : (
        <>
          <table>
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Outcome</th><th>Details</th></tr></thead>
            <tbody>
              {displayedItems.map((item, idx) => (
                <tr key={`${item.timestamp}-${idx}`}>
                  <td>{item.timestamp}</td><td>{item.username}</td><td>{item.action}</td><td><span className={`status-pill ${item.outcome || ''}`}>{item.outcome}</span></td><td>{item.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted table-meta">
            Showing {visibleRowCount(filteredItems.length, rowLimit)} of {filteredItems.length} entries
          </p>
        </>
      )}
    </section>
  )
}
