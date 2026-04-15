import { useCallback, useEffect, useState } from 'react'
import { normalizeRequestError, readJsonSafe } from '../utils/httpErrors'
import './BigQueryPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export function BigQueryPage({ token, embedded = false }) {
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
      const body = await readJsonSafe(r)
      if (r.ok) setStatus(body)
      else setStatus(null)
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
    const trimmed = (sql || '').trim()
    if (!trimmed) {
      setError('Enter a SQL query first.')
      setResult(null)
      return
    }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/bigquery/query`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: trimmed, max_rows: maxRows }),
      })
      const body = await readJsonSafe(r)
      if (!r.ok) {
        const msg = body.message || body.error || `Query failed (${r.status})`
        throw new Error(msg)
      }
      setResult(body)
    } catch (e) {
      setError(normalizeRequestError(e, 'Query failed'))
    } finally {
      setLoading(false)
    }
  }

  const projectId = status?.project || datasetsPayload?.project_id
  const consoleUrl = status?.console_url || datasetsPayload?.console_url

  const shellClass = embedded ? 'bigquery-page bigquery-page--embedded' : 'card bigquery-page'

  return (
    <section className={shellClass}>
      <h2>BigQuery</h2>
      <p className="page-caption">
        Listings match the GCP project. Use <code>Load SQL</code> or <code>project.dataset.table</code>. Mount your service
        account JSON under <code>secrets/</code> and set <code>GOOGLE_APPLICATION_CREDENTIALS</code> or{' '}
        <code>BIGQUERY_CREDENTIALS_PATH</code> (see <code>.env.example</code>). Grant Job User + dataset Data Viewer (or Admin for dev).
      </p>
      {status && (
        <p className="muted bq-status">
          Project: {status.project || '—'} · Default dataset: {status.default_dataset || '—'}
          {status.ingest_dataset ? ` · Ingest: ${status.ingest_dataset}` : ''}
          {status.dataset_location ? ` · Location: ${status.dataset_location}` : ''} · Credentials:{' '}
          {status.enabled ? 'ok' : status.feature_enabled === false ? 'BigQuery off' : 'missing'}
          {consoleUrl && (
            <>
              {' '}
              ·{' '}
              <a href={consoleUrl} target="_blank" rel="noreferrer">
                Console
              </a>
            </>
          )}
        </p>
      )}

      {status?.enabled && (
        <div className="bq-catalog">
          <div className="bq-catalog-head">
            <h3>Catalog</h3>
            <button type="button" className="ghost-btn" onClick={loadDatasets}>
              Refresh catalog
            </button>
          </div>
          {catalogError && <p className="error">{catalogError}</p>}
          {datasetsPayload?.datasets?.length === 0 && (
            <p className="muted">No datasets in this project.</p>
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
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            if (!loading && status?.feature_enabled !== false) runQuery()
          }
        }}
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
        <button
          type="button"
          onClick={runQuery}
          disabled={loading || status?.feature_enabled === false}
          title="Run (Ctrl+Enter)"
        >
          {loading ? 'Running…' : 'Run Query'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && result.columns && result.columns.length > 0 && (
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
              {(result.rows || []).map((row, idx) => (
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
      {result && (!result.columns || result.columns.length === 0) && (
        <div className="bq-result bq-result--empty">
          <p className="muted">Query finished: {result.row_count ?? 0} rows (empty results have no column preview in BigQuery).</p>
        </div>
      )}
    </section>
  )
}
