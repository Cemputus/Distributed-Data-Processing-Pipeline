import { useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './ETLJobsPage.css'

export function ETLJobsPage({ jobs, onTrigger, integrations }) {
  const [query, setQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(20)
  const filteredJobs = useMemo(
    () => jobs.filter((job) => `${job.job_name} ${job.status} ${job.triggered_by}`.toLowerCase().includes(query.toLowerCase())),
    [jobs, query],
  )
  const displayedJobs = useMemo(() => sliceByRowLimit(filteredJobs, rowLimit), [filteredJobs, rowLimit])

  const airflowUi = integrations?.airflow_ui_url

  return (
    <section className="card etl-page">
      <div className="section-head">
        <h2>ETL Jobs</h2>
        <div className="etl-actions">
          <input placeholder="Filter ETL jobs..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <RowsPerPageSelect value={rowLimit} onChange={setRowLimit} id="etl-jobs-rows" />
          <button onClick={onTrigger}>Run ETL</button>
        </div>
      </div>
      {integrations?.airflow_api_configured && (
        <p className="muted etl-airflow-hint">
          Run ETL triggers Apache Airflow DAG <strong>{integrations.airflow_dag_id || 'distributed_pipeline_scaffold'}</strong>{' '}
          (Spark on <code>spark://spark-master:7077</code>).{' '}
          {airflowUi && (
            <a href={airflowUi} target="_blank" rel="noreferrer">
              Open Airflow UI
            </a>
          )}
        </p>
      )}
      {filteredJobs.length === 0 ? <div className="empty-state">No ETL jobs yet.</div> : (
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Name</th>
              <th>Triggered By</th>
              <th>Status</th>
              <th>Airflow run</th>
              <th>Triggered At</th>
            </tr>
          </thead>
          <tbody>
            {displayedJobs.map((job) => (
              <tr key={job.job_id}>
                <td>{job.job_id}</td>
                <td>{job.job_name}</td>
                <td>{job.triggered_by}</td>
                <td><span className={`status-pill ${job.status || ''}`}>{job.status}</span></td>
                <td className="etl-airflow-cell">
                  {job.airflow_dag_run_id ? (
                    <span title={job.airflow_error || ''}>{job.airflow_dag_run_id.slice(0, 8)}…</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {job.airflow_error && <span className="etl-airflow-err" title={job.airflow_error}> ⚠</span>}
                </td>
                <td>{job.triggered_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {filteredJobs.length > 0 && (
        <p className="muted table-meta">
          Showing {visibleRowCount(filteredJobs.length, rowLimit)} of {filteredJobs.length} jobs
        </p>
      )}
    </section>
  )
}
