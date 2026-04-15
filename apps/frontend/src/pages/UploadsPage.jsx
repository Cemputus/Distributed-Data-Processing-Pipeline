import { useState } from 'react'
import './UploadsPage.css'

export function UploadsPage({ catalog, uploadResult, successfulUploads, failedUploads, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [query, setQuery] = useState('')
  const filteredSuccess = successfulUploads.filter((item) => item.dataset.toLowerCase().includes(query.toLowerCase()))
  const filteredFailed = failedUploads.filter((item) => item.dataset.toLowerCase().includes(query.toLowerCase()))

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
        <h2>Successful Uploads</h2>
        <input placeholder="Filter by dataset..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {filteredSuccess.length === 0 ? <div className="empty-state">No successful uploads yet.</div> : (
          <table>
            <thead><tr><th>Timestamp</th><th>Dataset</th><th>Rows</th><th>Status</th></tr></thead>
            <tbody>
              {filteredSuccess.map((item) => (
                <tr key={`${item.uploaded_at}-${item.dataset}`}>
                  <td>{item.uploaded_at}</td><td>{item.dataset}</td><td>{item.row_count ?? '-'}</td><td><span className="status-pill success">{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Failed Uploads</h2>
        {filteredFailed.length === 0 ? <div className="empty-state">No failed uploads yet.</div> : (
          <table>
            <thead><tr><th>Timestamp</th><th>Dataset</th><th>Error</th><th>Status</th></tr></thead>
            <tbody>
              {filteredFailed.map((item) => (
                <tr key={`${item.uploaded_at}-${item.dataset}`}>
                  <td>{item.uploaded_at}</td><td>{item.dataset}</td><td>{item.error || '-'}</td><td><span className="status-pill failed">{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
