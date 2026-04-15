import { useEffect, useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './ETLJobsPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const SCOPE_OPTIONS = [
  { value: 'delegate_only', label: 'ETL only' },
  { value: 'preprocess_single', label: 'Preprocess one file + ETL' },
  { value: 'preprocess_all', label: 'Preprocess all pending + ETL' },
]

export function ETLJobsPage({ jobs, onTrigger, integrations, token }) {
  const [query, setQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(20)
  const [scope, setScope] = useState('delegate_only')
  const [datasetName, setDatasetName] = useState('')
  const [busy, setBusy] = useState(false)
  const [spark, setSpark] = useState(null)
  const [sparkLoading, setSparkLoading] = useState(false)

  const filteredJobs = useMemo(
    () => jobs.filter((job) => `${job.job_name} ${job.status} ${job.triggered_by}`.toLowerCase().includes(query.toLowerCase())),
    [jobs, query],
  )
  const displayedJobs = useMemo(() => sliceByRowLimit(filteredJobs, rowLimit), [filteredJobs, rowLimit])

  const airflowUi = integrations?.airflow_ui_url
  const sparkUi = integrations?.spark_master_ui_url || spark?.spark_ui_url

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

    async function loadSpark() {
      setSparkLoading(true)
      try {
        const response = await fetch(`${API_BASE}/api/integrations/spark`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) {
          setSpark({
            reachable: false,
            error: body.message || body.error || `HTTP ${response.status}`,
          })
          return
        }
        setSpark(body)
      } catch (e) {
        if (!cancelled) setSpark({ reachable: false, error: e.message || String(e) })
      } finally {
        if (!cancelled) setSparkLoading(false)
      }
    }

    loadSpark()
    const interval = setInterval(loadSpark, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [token])

  async function handleRun() {
    setBusy(true)
    try {
      await onTrigger(scope, scope === 'preprocess_single' ? datasetName.trim() : undefined)
    } finally {
      setBusy(false)
    }
  }

  const workers = spark?.workers || []
  const completedApps = spark?.completed_applications || []
  const activeApps = spark?.active_applications || []

  return (
    <section className="card etl-page">
      <div className="section-head">
        <h2>ETL</h2>
        <div className="etl-actions">
          <input placeholder="Filter ETL jobs..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <RowsPerPageSelect value={rowLimit} onChange={setRowLimit} id="etl-jobs-rows" />
        </div>
      </div>

      <div className="etl-run-panel">
        <p className="muted etl-run-intro">
          Preprocess optional, then Airflow and delegate ETL. Use “ETL only” when data is already analytics-ready.
        </p>
        <div className="etl-run-controls">
          <label className="etl-scope-label">
            <span>Scope</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {scope === 'preprocess_single' && (
            <label className="etl-dataset-label">
              <span>Dataset file name</span>
              <input
                type="text"
                placeholder="e.g. dim_accounts.csv"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
              />
            </label>
          )}
          <button
            type="button"
            className="etl-run-btn"
            disabled={busy || (scope === 'preprocess_single' && !datasetName.trim())}
            onClick={handleRun}
          >
            {busy ? 'Starting…' : 'Run'}
          </button>
        </div>
      </div>

      <div className="spark-cluster-panel">
        <div className="spark-cluster-head">
          <h3 className="spark-cluster-title">Spark</h3>
          {sparkUi && (
            <a className="spark-cluster-link" href={sparkUi} target="_blank" rel="noreferrer">
              Open Spark Master UI
            </a>
          )}
        </div>
        {sparkLoading && !spark ? (
          <p className="muted spark-cluster-msg">Loading…</p>
        ) : null}
        {spark && !spark.reachable ? (
          <p className="spark-cluster-err" role="alert">
            Could not read Spark Master API{spark.error ? `: ${spark.error}` : ''}. Ensure <code>spark-master</code> is up
            and the API container can reach it at <code>http://spark-master:8085</code> (see compose env).
          </p>
        ) : null}
        {spark?.reachable ? (
          <div className="spark-tables">
            <div className="spark-table-wrap">
              <p className="spark-table-caption">Workers ({workers.length})</p>
              {workers.length === 0 ? (
                <p className="muted spark-empty">No workers registered yet.</p>
              ) : (
                <div className="spark-scroll">
                  <table className="spark-mini-table">
                    <thead>
                      <tr>
                        <th>Host</th>
                        <th>State</th>
                        <th>Cores</th>
                        <th>Memory (MB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((w) => (
                        <tr key={w.id || `${w.host}-${w.port}`}>
                          <td>{w.host ? `${w.host}:${w.port ?? ''}` : '—'}</td>
                          <td>{w.state ?? '—'}</td>
                          <td>{w.cores ?? '—'}</td>
                          <td>{w.memory_mb ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="spark-table-wrap">
              <p className="spark-table-caption">Completed applications ({completedApps.length})</p>
              {completedApps.length === 0 ? (
                <p className="muted spark-empty">No completed apps yet.</p>
              ) : (
                <div className="spark-scroll">
                  <table className="spark-mini-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>App ID</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedApps.slice(0, 25).map((a) => {
                        const idStr = a.id != null ? String(a.id) : ''
                        const shortId = idStr.length > 20 ? `${idStr.slice(0, 18)}…` : idStr || '—'
                        return (
                          <tr key={a.id || a.name}>
                            <td>{a.name ?? '—'}</td>
                            <td className="spark-id-cell">{shortId}</td>
                            <td>{a.duration_ms != null ? `${Math.round(Number(a.duration_ms) / 1000)}s` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {activeApps.length > 0 ? (
              <div className="spark-table-wrap spark-active-wrap">
                <p className="spark-table-caption">Running ({activeApps.length})</p>
                <div className="spark-scroll">
                  <table className="spark-mini-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>App ID</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeApps.map((a) => {
                        const idStr = a.id != null ? String(a.id) : ''
                        const shortId = idStr.length > 20 ? `${idStr.slice(0, 18)}…` : idStr || '—'
                        return (
                          <tr key={a.id || a.name}>
                            <td>{a.name ?? '—'}</td>
                            <td className="spark-id-cell">{shortId}</td>
                            <td>{a.state ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {integrations?.airflow_api_configured && (
        <p className="muted etl-airflow-hint">
          DAG <code>{integrations.airflow_dag_id || 'distributed_pipeline_scaffold'}</code> · Spark <code>spark://spark-master:7077</code>
          {airflowUi && (
            <>
              {' · '}
              <a href={airflowUi} target="_blank" rel="noreferrer">
                Airflow
              </a>
            </>
          )}
        </p>
      )}
      {filteredJobs.length === 0 ? (
        <div className="empty-state">No ETL jobs yet.</div>
      ) : (
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
                <td title={job.message || job.airflow_error || ''}>
                  <span className={`status-pill ${job.status || ''}`}>{job.status}</span>
                  {job.message && <span className="muted etl-job-note">{job.message}</span>}
                </td>
                <td className="etl-airflow-cell">
                  {job.airflow_dag_run_id ? (
                    <span title={job.airflow_error || ''}>{job.airflow_dag_run_id.slice(0, 8)}…</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {job.airflow_error && (
                    <span className="etl-airflow-err" title={job.airflow_error}>
                      {' '}
                      ⚠
                    </span>
                  )}
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
