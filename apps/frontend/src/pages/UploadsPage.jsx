import { useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './UploadsPage.css'

export function UploadsPage({ catalog, uploadResult, successfulUploads, failedUploads, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [query, setQuery] = useState('')
  const [successRowLimit, setSuccessRowLimit] = useState(20)
  const [failedRowLimit, setFailedRowLimit] = useState(20)
  const filteredSuccess = useMemo(
    () => successfulUploads.filter((item) => item.dataset.toLowerCase().includes(query.toLowerCase())),
    [successfulUploads, query],
  )
  const filteredFailed = useMemo(
    () => failedUploads.filter((item) => item.dataset.toLowerCase().includes(query.toLowerCase())),
    [failedUploads, query],
  )
  const displayedSuccess = useMemo(() => sliceByRowLimit(filteredSuccess, successRowLimit), [filteredSuccess, successRowLimit])
  const displayedFailed = useMemo(() => sliceByRowLimit(filteredFailed, failedRowLimit), [filteredFailed, failedRowLimit])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedFile) return
    await onUpload(selectedFile)
  }

  return (
    <div className="uploads-page stack-sections">
      <section className="card">
        <h2>Upload Operations</h2>
        <p className="subtitle">Preloaded dataset: <strong>{catalog.preloaded_dataset}</strong></p>
        <p className="muted">{catalog.message}</p>
        <form className="upload-form" onSubmit={handleSubmit}>
          <label>
            Dataset CSV file
            <input type="file" accept=".csv" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
          </label>
          <button type="submit">Run 3-Stage Upload Pipeline</button>
        </form>
        {uploadResult && (
          <div className={`upload-result ${uploadResult.status}`}>
            <p><strong>Dataset:</strong> {uploadResult.dataset}</p>
            <p><strong>Classification:</strong> {uploadResult.classification}</p>
            <p><strong>Status:</strong> {uploadResult.status}</p>
            {uploadResult.error && <p><strong>Error:</strong> {uploadResult.error}</p>}
            <ul>
              {(uploadResult.stages || []).map((stage, index) => (
                <li key={`${stage.stage}-${index}`}>{stage.stage}: {stage.status} - {stage.message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Successful Uploads</h2>
          <div className="section-head-controls">
            <input placeholder="Filter by dataset..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <RowsPerPageSelect value={successRowLimit} onChange={setSuccessRowLimit} id="uploads-success-rows" />
          </div>
        </div>
        {filteredSuccess.length === 0 ? <div className="empty-state">No successful uploads yet.</div> : (
          <>
            <table>
              <thead><tr><th>Timestamp</th><th>Dataset</th><th>Rows</th><th>Status</th></tr></thead>
              <tbody>
                {displayedSuccess.map((item) => (
                  <tr key={`${item.uploaded_at}-${item.dataset}`}>
                    <td>{item.uploaded_at}</td><td>{item.dataset}</td><td>{item.row_count ?? '-'}</td><td><span className="status-pill success">{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted table-meta">
              Showing {visibleRowCount(filteredSuccess.length, successRowLimit)} of {filteredSuccess.length} uploads
            </p>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Failed Uploads</h2>
          <RowsPerPageSelect value={failedRowLimit} onChange={setFailedRowLimit} id="uploads-failed-rows" />
        </div>
        {filteredFailed.length === 0 ? <div className="empty-state">No failed uploads yet.</div> : (
          <>
            <table>
              <thead><tr><th>Timestamp</th><th>Dataset</th><th>Error</th><th>Status</th></tr></thead>
              <tbody>
                {displayedFailed.map((item) => (
                  <tr key={`${item.uploaded_at}-${item.dataset}`}>
                    <td>{item.uploaded_at}</td><td>{item.dataset}</td><td>{item.error || '-'}</td><td><span className="status-pill failed">{item.status}</span></td>
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
