import { useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './DatasetsPage.css'

export function DatasetsPage({ datasets, onDelete }) {
  const [query, setQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(20)
  const [previewRowLimit, setPreviewRowLimit] = useState(20)
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const filtered = useMemo(
    () =>
      datasets.filter((item) =>
        `${item.dataset} ${item.classification} ${item.status} ${item.pipeline_status || ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [datasets, query],
  )
  const displayedDatasets = useMemo(() => sliceByRowLimit(filtered, rowLimit), [filtered, rowLimit])
  const previewRows = useMemo(
    () => (preview ? sliceByRowLimit(preview.rows || [], previewRowLimit) : []),
    [preview, previewRowLimit],
  )

  function confirmDelete(datasetName) {
    if (!onDelete) return
    if (!window.confirm(`Remove ${datasetName} from the catalog and delete associated files?`)) return
    onDelete(datasetName)
  }

  async function loadPreview(datasetName) {
    setPreviewError('')
    try {
      const token = localStorage.getItem('token') || ''
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/datasets/${encodeURIComponent(datasetName)}/preview?limit=20`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 403) throw new Error('')
        throw new Error(body.message || body.error || 'Failed to preview')
      }
      setPreview(body)
    } catch (err) {
      if (err.message) setPreviewError(err.message)
      setPreview(null)
    }
  }

  return (
    <section className="card datasets-page">
      <div className="section-head">
        <h2>Datasets</h2>
        <div className="section-head-controls">
          <input placeholder="Filter datasets..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <RowsPerPageSelect value={rowLimit} onChange={setRowLimit} id="datasets-catalog-rows" />
        </div>
      </div>
      <p className="page-caption">
        Registry of uploads. Query and KPIs use <code>analytics_ready</code> data; “landed” is ingest only.
      </p>
      {filtered.length === 0 ? <div className="empty-state">No datasets uploaded yet.</div> : (
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Dataset</th>
              <th>Class</th>
              <th>Rows</th>
              <th>Pipeline</th>
              <th>Status</th>
              <th>Columns</th>
              <th>Preview</th>
              {onDelete ? <th>Remove</th> : null}
            </tr>
          </thead>
          <tbody>
            {displayedDatasets.map((item, idx) => (
              <tr key={`${item.uploaded_at}-${item.dataset}-${idx}`}>
                <td>{item.uploaded_at}</td>
                <td>{item.dataset}</td>
                <td><span className={`status-pill ${item.classification || ''}`}>{item.classification || '-'}</span></td>
                <td>{item.row_count ?? '-'}</td>
                <td>
                  <span className="status-pill">{item.pipeline_status || '—'}</span>
                </td>
                <td><span className={`status-pill ${item.status || ''}`}>{item.status}</span></td>
                <td>{Array.isArray(item.insights?.columns) ? item.insights.columns.length : '-'}</td>
                <td><button type="button" className="ghost-btn" onClick={() => loadPreview(item.dataset)}>View</button></td>
                {onDelete ? (
                  <td>
                    <button type="button" className="ghost-btn datasets-delete-btn" onClick={() => confirmDelete(item.dataset)}>
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {filtered.length > 0 && (
        <p className="muted table-meta">
          Showing {visibleRowCount(filtered.length, rowLimit)} of {filtered.length} datasets
        </p>
      )}
      {previewError && <p className="error">{previewError}</p>}
      {preview && (
        <section className="preview-panel">
          <div className="section-head">
            <h3>Preview · {preview.dataset}</h3>
            <div className="section-head-controls">
              <span className="muted">Rows: {preview.row_count}</span>
              <RowsPerPageSelect value={previewRowLimit} onChange={setPreviewRowLimit} id="datasets-preview-rows" label="Preview rows" />
            </div>
          </div>
          <table>
            <thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`preview-${index}`}>
                  {preview.columns.map((column) => <td key={`${index}-${column}`}>{String(row[column] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {(preview.rows || []).length > 0 && (
            <p className="muted table-meta">
              Showing {visibleRowCount((preview.rows || []).length, previewRowLimit)} of {(preview.rows || []).length} preview rows
            </p>
          )}
        </section>
      )}
    </section>
  )
}
