import { useMemo, useState } from 'react'
import './ETLJobsPage.css'

export function ETLJobsPage({ jobs, onTrigger }) {
  const [query, setQuery] = useState('')
  const filteredJobs = useMemo(
    () => jobs.filter((job) => `${job.job_name} ${job.status} ${job.triggered_by}`.toLowerCase().includes(query.toLowerCase())),
    [jobs, query],
  )

  return (
    <section className="card etl-page">
      <div className="section-head">
        <h2>ETL Jobs</h2>
        <div className="etl-actions">
          <input placeholder="Filter ETL jobs..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={onTrigger}>Run ETL</button>
        </div>
      </div>
      {filteredJobs.length === 0 ? <div className="empty-state">No ETL jobs yet.</div> : (
        <table>
          <thead><tr><th>Job ID</th><th>Name</th><th>Triggered By</th><th>Status</th><th>Triggered At</th></tr></thead>
          <tbody>
            {filteredJobs.map((job) => (
              <tr key={job.job_id}>
                <td>{job.job_id}</td><td>{job.job_name}</td><td>{job.triggered_by}</td><td><span className={`status-pill ${job.status || ''}`}>{job.status}</span></td><td>{job.triggered_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
