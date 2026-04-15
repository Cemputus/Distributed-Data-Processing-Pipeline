import { useCallback, useEffect, useState } from 'react'
import './BigQueryPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export function BigQueryPage({ token }) {
  const [sql, setSql] = useState(
    'SELECT word FROM `bigquery-public-data.samples.shakespeare` LIMIT 10',
  )
  const [maxRows, setMaxRows] = useState(100)
  const [status, setStatus] = useState(null)
  const [datasetsPayload, setDatasetsPayload] = useState(null)
  const [tablesByDataset, setTablesByDataset] = useState({})
  const [loadingTables, setLoadingTables] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')

  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/bigquery/status`, { headers })
      const body = await r.json()
      if (r.ok) setStatus(body)
    } catch {
      setStatus(null)
    }
  }, [token])

  const loadDatasets = useCallback(async () => {
    setCatalogError('')
    try {
      const r = await fetch(`${API_BASE}/api/bigquery/datasets`, { headers })
      const body = await r.json()
      if (!r.ok) throw new Error(body.message || body.error || 'Failed to list datasets')
      setDatasetsPayload(body)
    } catch (e) {
      setDatasetsPayload(null)
      setCatalogError(e.message || String(e))
    }
  }, [token])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (status?.enabled) loadDatasets()
  }, [status?.enabled, loadDatasets])

  async function loadTablesForDataset(datasetId) {
    if (tablesByDataset[datasetId] || loadingTables[datasetId]) return
    setLoadingTables((p) => ({ ...p, [datasetId]: true }))
    setCatalogError('')
    try {
      const r = await fetch(`${API_BASE}/api/bigquery/datasets/${encodeURIComponent(datasetId)}/tables`, { headers })
      const body = await r.json()
      if (!r.ok) throw new Error(body.message || body.error || 'Failed to list tables')
      setTablesByDataset((p) => ({ ...p, [datasetId]: body.tables || [] }))
    } catch (e) {
      setCatalogError(e.message || String(e))
    } finally {
      setLoadingTables((p) => ({ ...p, [datasetId]: false }))
    }
  }

  async function runQuery() {
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/bigquery/query`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, max_rows: maxRows }),
      })
      const body = await r.json()
      if (!r.ok) throw new Error(body.message || body.error || 'Query failed')
      setResult(body)
    } catch (e) {
      setError(e.message || e)
    } finally {
      setLoading(false)
    }
  }

  const projectId = status?.project || datasetsPayload?.project_id
  const consoleUrl = status?.console_url || datasetsPayload?.console_url

  return (
    <section className="card bigquery-page">
      <h2>BigQuery (GCP warehouse)</h2>
      <p className="subtitle">
        Browse datasets and tables (same project as the Google Cloud console). Use <strong>Load SQL</strong> from the
        catalog for your project&apos;s tables, or fully qualified names like{' '}
        <code>project.dataset.table</code>. The default query below uses a real public sample table. Service account:{' '}
        <code>secrets/gcp-sa.json</code>. Grant it <strong>BigQuery Data Viewer</strong>,{' '}
        <strong>BigQuery Job User</strong>, and <strong>BigQuery Metadata Viewer</strong> (or <strong>BigQuery Admin</strong>{' '}
        for dev) on project <code>{projectId || 'your-project'}</code> so listings match the console.
      </p>
      {status && (
        <p className="muted bq-status">
          Project: <strong>{status.project || '—'}</strong> · Default dataset:{' '}
          <strong>{status.default_dataset || '—'}</strong> · Credentials:{' '}
          <strong>{status.enabled ? 'mounted' : 'missing'}</strong>
          {consoleUrl && (
            <>
              {' '}
              ·{' '}
              <a href={consoleUrl} target="_blank" rel="noreferrer">
                Open BigQuery console
              </a>
            </>
          )}
        </p>
      )}

      {status?.enabled && (
        <div className="bq-catalog">
          <div className="bq-catalog-head">
            <h3>Datasets &amp; tables</h3>
            <button type="button" className="ghost-btn" onClick={loadDatasets}>
              Refresh catalog
            </button>
          </div>
          {catalogError && <p className="error">{catalogError}</p>}
          {datasetsPayload?.datasets?.length === 0 && (
            <p className="muted">No datasets in this project yet. Create them in the BigQuery console.</p>
          )}
          <ul className="bq-dataset-list">
            {datasetsPayload?.datasets?.map((ds) => (
              <li key={ds.dataset_id} className="bq-dataset-item">
                <details
                  onToggle={(e) => {
                    if (e.target.open) loadTablesForDataset(ds.dataset_id)
                  }}
                >
                  <summary className="bq-dataset-summary">
                    <span className="bq-dataset-id">{ds.dataset_id}</span>
                    <a
                      href={ds.console_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bq-console-link"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      Console
                    </a>
                  </summary>
                  {loadingTables[ds.dataset_id] && <p className="muted">Loading tables…</p>}
                  <ul className="bq-table-list">
                    {(tablesByDataset[ds.dataset_id] || []).map((t) => (
                      <li key={t.table_id} className="bq-table-row">
                        <span className="bq-table-meta">
                          <code>{t.table_id}</code>
                          <span className="muted">{t.table_type}</span>
                        </span>
                        <span className="bq-table-actions">
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => setSql(t.select_preview_sql)}
                          >
                            Load SQL
                          </button>
                          <a href={t.console_url} target="_blank" rel="noreferrer" className="bq-console-link">
                            Table in console
                          </a>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="bq-sql-heading">SQL</h3>
      <textarea
        className="sql-editor"
        rows={8}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
      />
      <div className="bq-actions">
        <label className="muted">
          Max rows{' '}
          <input
            type="number"
            min={1}
            max={500}
            value={maxRows}
            onChange={(e) => setMaxRows(Number(e.target.value))}
          />
        </label>
        <button type="button" onClick={runQuery} disabled={loading || (status && !status.enabled)}>
          {loading ? 'Running…' : 'Run Query'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && result.columns?.length > 0 && (
        <div className="bq-result">
          <p className="muted">Rows: {result.row_count}</p>
          <table>
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, idx) => (
                <tr key={idx}>
                  {result.columns.map((c) => (
                    <td key={c}>{String(row[c] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
