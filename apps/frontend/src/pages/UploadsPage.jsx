import { useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './UploadsPage.css'

export function UploadsPage({
  catalog,
  uploadResult,
  successfulUploads,
  pendingLandings,
  failedUploads,
  integrations,
  onUpload,
  onProcessDataset,
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [query, setQuery] = useState('')
  const [successRowLimit, setSuccessRowLimit] = useState(20)
  const [pendingRowLimit, setPendingRowLimit] = useState(20)
  const [failedRowLimit, setFailedRowLimit] = useState(20)
  const [busyKey, setBusyKey] = useState('')

  const filteredSuccess = useMemo(
    () => successfulUploads.filter((item) => item.dataset.toLowerCase().includes(query.toLowerCase())),
    [successfulUploads, query],
  )
  const filteredPending = useMemo(
    () => pendingLandings.filter((item) => item.dataset.toLowerCase().includes(query.toLowerCase())),
    [pendingLandings, query],
  )
  const filteredFailed = useMemo(
    () => failedUploads.filter((item) => item.dataset.toLowerCase().includes(query.toLowerCase())),
    [failedUploads, query],
  )
  const displayedSuccess = useMemo(() => sliceByRowLimit(filteredSuccess, successRowLimit), [filteredSuccess, successRowLimit])
  const displayedPending = useMemo(() => sliceByRowLimit(filteredPending, pendingRowLimit), [filteredPending, pendingRowLimit])
  const displayedFailed = useMemo(() => sliceByRowLimit(filteredFailed, failedRowLimit), [filteredFailed, failedRowLimit])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedFile) return
    await onUpload(selectedFile)
  }

  async function runProcess(mode, dataset, runEtl, busyId) {
    setBusyKey(busyId)
    try {
      await onProcessDataset(mode, dataset, runEtl)
    } finally {
      setBusyKey('')
    }
  }

  const minioConsole = integrations?.minio_console_url
  const minioBucket = integrations?.minio_bucket
  const minioOn = integrations?.minio_endpoint_configured

  return (
    <div className="uploads-page stack-sections">
      <section className="card uploads-minio-panel">
        <h2>MinIO</h2>
        {minioOn ? (
          <p className="page-caption uploads-minio-copy">
            Uploads are saved to <code>uploads/landing/</code> and mirrored to bucket{' '}
            <code>{minioBucket || 'fintech-landing'}</code>.
          </p>
        ) : (
          <p className="muted uploads-minio-copy">
            MinIO is not configured for this API process (<code>MINIO_ENDPOINT</code> is not set).
          </p>
        )}
        {minioOn && minioConsole && (
          <p className="uploads-minio-actions">
            <a className="uploads-minio-console-link" href={minioConsole} target="_blank" rel="noreferrer">
              Open MinIO Console
            </a>
            <span className="muted"> — sign in with values in <code>.env</code>.</span>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Upload</h2>
        <p className="page-caption">Reference: <code>{catalog.preloaded_dataset}</code></p>
        <p className="muted">
          Upload stores a CSV in landing. Processing and ETL are separate steps.
        </p>
        <p className="muted">{catalog.message}</p>
        <form className="upload-form" onSubmit={handleSubmit}>
          <label>
            Dataset CSV file
            <input type="file" accept=".csv" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
          </label>
          <button type="submit">Upload to landing</button>
        </form>
        {uploadResult && (
          <div className={`upload-result ${uploadResult.status}`}>
            <p>Dataset: {uploadResult.dataset}</p>
            <p>Classification: {uploadResult.classification}</p>
            <p>Status: {uploadResult.status}</p>
            {uploadResult.error && (
              <p>Error: {uploadResult.error}</p>
            )}
            <ul>
              {(uploadResult.stages || []).map((stage, index) => (
                <li key={`${stage.stage}-${index}`}>
                  {stage.stage}: {stage.status} - {stage.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Pending</h2>
          <div className="section-head-controls">
            <input placeholder="Filter by dataset..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <RowsPerPageSelect value={pendingRowLimit} onChange={setPendingRowLimit} id="uploads-pending-rows" />
          </div>
        </div>
        <p className="muted uploads-process-hint">Process validates, publishes, and marks files <code>analytics_ready</code>.</p>
        {filteredPending.length === 0 ? (
          <div className="empty-state">No files waiting for processing.</div>
        ) : (
          <>
            <div className="uploads-pending-toolbar">
              <button
                type="button"
                disabled={!!busyKey}
                onClick={() => runProcess('all', null, false, 'all-pre')}
              >
                {busyKey === 'all-pre' ? 'Processing…' : 'Process all pending (preprocess only)'}
              </button>
              <button
                type="button"
                disabled={!!busyKey}
                onClick={() => runProcess('all', null, true, 'all-etl')}
              >
                {busyKey === 'all-etl' ? 'Running…' : 'Process all pending + run ETL'}
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Uploaded</th>
                  <th>Dataset</th>
                  <th>Landing file</th>
                  <th colSpan={2}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedPending.map((item) => {
                  const key = `${item.uploaded_at}-${item.dataset}`
                  return (
                    <tr key={key}>
                      <td>{item.uploaded_at}</td>
                      <td>{item.dataset}</td>
                      <td className="muted">{item.landing_file || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={!!busyKey}
                          onClick={() => runProcess('single', item.dataset, false, `single-${key}`)}
                        >
                          {busyKey === `single-${key}` ? '…' : 'Process'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          disabled={!!busyKey}
                          onClick={() => runProcess('single', item.dataset, true, `etl-${key}`)}
                        >
                          {busyKey === `etl-${key}` ? '…' : 'Process + ETL'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="muted table-meta">
              Showing {visibleRowCount(filteredPending.length, pendingRowLimit)} of {filteredPending.length} pending
            </p>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Ready</h2>
          <div className="section-head-controls">
            <input placeholder="Filter by dataset..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <RowsPerPageSelect value={successRowLimit} onChange={setSuccessRowLimit} id="uploads-success-rows" />
          </div>
        </div>
        <p className="muted">Ready for dashboard and query usage.</p>
        {filteredSuccess.length === 0 ? (
          <div className="empty-state">No analytics-ready uploads yet.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Dataset</th>
                  <th>Rows</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedSuccess.map((item) => (
                  <tr key={`${item.uploaded_at}-${item.dataset}`}>
                    <td>{item.uploaded_at}</td>
                    <td>{item.dataset}</td>
                    <td>{item.row_count ?? '-'}</td>
                    <td>
                      <span className="status-pill success">{item.pipeline_status || item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted table-meta">
              Showing {visibleRowCount(filteredSuccess.length, successRowLimit)} of {filteredSuccess.length} records
            </p>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Failed</h2>
          <RowsPerPageSelect value={failedRowLimit} onChange={setFailedRowLimit} id="uploads-failed-rows" />
        </div>
        {filteredFailed.length === 0 ? (
          <div className="empty-state">No failed uploads yet.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Dataset</th>
                  <th>Error</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedFailed.map((item) => (
                  <tr key={`${item.uploaded_at}-${item.dataset}`}>
                    <td>{item.uploaded_at}</td>
                    <td>{item.dataset}</td>
                    <td>{item.error || '-'}</td>
                    <td>
                      <span className="status-pill failed">{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted table-meta">
              Showing {visibleRowCount(filteredFailed.length, failedRowLimit)} of {filteredFailed.length} failed uploads
            </p>
          </>
        )}
      </section>
    </div>
  )
}
