import { useCallback, useEffect, useState } from 'react'
import { normalizeRequestError, readJsonSafe } from '../utils/httpErrors'
import './BigQueryPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

function toNumeric(value) {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function detectNumericColumns(columns, rows) {
  return (columns || []).filter((col) => (rows || []).some((row) => toNumeric(row?.[col]) != null))
}

function bqSeries(columns, rows, xColumn, yColumn) {
  if (!xColumn || !yColumn) return []
  return (rows || [])
    .map((row) => ({ label: String(row?.[xColumn] ?? ''), value: toNumeric(row?.[yColumn]) }))
    .filter((item) => item.label && item.value != null)
    .slice(0, 20)
}

function QueryChart({ type, series }) {
  if (!series.length) return <p className="muted">No plottable rows found for selected columns.</p>
  const max = Math.max(1, ...series.map((s) => s.value))

  if (type === 'line') {
    const points = series
      .map((item, i) => {
        const x = (i / Math.max(1, series.length - 1)) * 100
        const y = 100 - (item.value / max) * 100
        return `${x},${y}`
      })
      .join(' ')
    return (
      <div className="bq-chart bq-chart--line">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="line chart">
          <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2.5" />
          {series.map((item, i) => {
            const x = (i / Math.max(1, series.length - 1)) * 100
            const y = 100 - (item.value / max) * 100
            return <circle key={`${item.label}-${i}`} cx={x} cy={y} r="2.2" fill="#1d4ed8" />
          })}
        </svg>
        <div className="bq-chart-legend">
          {series.map((s, i) => (
            <span key={`${s.label}-${i}`} title={`${s.label}: ${s.value.toLocaleString()}`}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'pie') {
    const total = series.reduce((acc, s) => acc + s.value, 0) || 1
    let start = 0
    const slices = series.slice(0, 10).map((s, i) => {
      const frac = s.value / total
      const end = start + frac
      const largeArc = frac > 0.5 ? 1 : 0
      const a0 = start * Math.PI * 2 - Math.PI / 2
      const a1 = end * Math.PI * 2 - Math.PI / 2
      const x0 = 50 + 40 * Math.cos(a0)
      const y0 = 50 + 40 * Math.sin(a0)
      const x1 = 50 + 40 * Math.cos(a1)
      const y1 = 50 + 40 * Math.sin(a1)
      const color = `hsl(${(i * 41 + 220) % 360} 72% 50%)`
      const path = `M 50 50 L ${x0} ${y0} A 40 40 0 ${largeArc} 1 ${x1} ${y1} Z`
      start = end
      return { ...s, path, color }
    })
    return (
      <div className="bq-chart bq-chart--pie">
        <svg viewBox="0 0 100 100" aria-label="pie chart">
          {slices.map((s, i) => (
            <path key={`${s.label}-${i}`} d={s.path} fill={s.color}>
              <title>{`${s.label}: ${s.value.toLocaleString()}`}</title>
            </path>
          ))}
        </svg>
        <ul className="bq-pie-legend">
          {slices.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              <span style={{ background: s.color }} />
              <strong>{s.label}</strong>
              <em>{s.value.toLocaleString()}</em>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="bq-chart bq-chart--bars">
      {series.map((item, i) => {
        const width = Math.max(2, Math.round((item.value / max) * 100))
        return (
          <div className="bq-bar-row" key={`${item.label}-${i}`} title={`${item.label}: ${item.value.toLocaleString()}`}>
            <span>{item.label}</span>
            <div className="bq-bar-track">
              <div className="bq-bar-fill" style={{ width: `${width}%` }} />
            </div>
            <strong>{item.value.toLocaleString()}</strong>
          </div>
        )
      })}
    </div>
  )
}

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
  const [chartType, setChartType] = useState('table')
  const [xColumn, setXColumn] = useState('')
  const [yColumn, setYColumn] = useState('')
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

  useEffect(() => {
    const cols = result?.columns || []
    const nums = detectNumericColumns(cols, result?.rows || [])
    setXColumn((prev) => (prev && cols.includes(prev) ? prev : cols[0] || ''))
    setYColumn((prev) => (prev && nums.includes(prev) ? prev : nums[0] || ''))
  }, [result])

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
  const columns = result?.columns || []
  const rows = result?.rows || []
  const numericColumns = detectNumericColumns(columns, rows)
  const chosenX = xColumn || columns[0] || ''
  const chosenY = yColumn || numericColumns[0] || ''
  const canChart = columns.length > 1 && numericColumns.length > 0
  const series = bqSeries(columns, rows, chosenX, chosenY)

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
          <div className="bq-result-head">
            <p className="muted">Rows: {result.row_count}</p>
            <div className="bq-viz-controls">
              <label>
                View
                <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                  <option value="table">Table</option>
                  <option value="bar">Bar chart</option>
                  <option value="line">Line chart</option>
                  <option value="pie">Pie chart</option>
                </select>
              </label>
              {chartType !== 'table' && (
                <>
                  <label>
                    X
                    <select value={chosenX} onChange={(e) => setXColumn(e.target.value)}>
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Y
                    <select value={chosenY} onChange={(e) => setYColumn(e.target.value)}>
                      {numericColumns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          </div>
          {chartType === 'table' || !canChart ? (
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
          ) : (
            <QueryChart type={chartType === 'bar' ? 'bar' : chartType} series={series} />
          )}
          {chartType !== 'table' && !canChart && (
            <p className="muted">Need at least one text-like column and one numeric column to render charts.</p>
          )}
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
