import { useEffect, useState } from 'react'
import './CENQueryPage.css'

export function CENQueryPage({ queryResult, onRunQuery }) {
  const [query, setQuery] = useState(localStorage.getItem('cenquery:lastQuery') || 'SELECT c.customer_id, c.full_name, a.account_id FROM dim_customers c LEFT JOIN dim_accounts a ON c.customer_id = a.customer_id LIMIT 20')
  const [isLoading, setIsLoading] = useState(false)

  const numericColumn = queryResult?.columns?.find((col) => {
    const sample = queryResult.rows?.find((row) => typeof row[col] === 'number')
    return typeof sample?.[col] === 'number'
  })
  const labelColumn = queryResult?.columns?.[0]
  const chartRows = (queryResult?.rows || []).slice(0, 14)
  const maxValue = chartRows.reduce((acc, row) => Math.max(acc, Number(row[numericColumn] || 0)), 1)

  async function runQuery() {
    setIsLoading(true)
    await onRunQuery(query)
    setIsLoading(false)
  }

  useEffect(() => {
    localStorage.setItem('cenquery:lastQuery', query)
  }, [query])

  return (
    <section className="card query-page">
      <div className="query-head">
        <div>
          <h2>CEN Query (Read-Only SQL Workspace)</h2>
          <p className="subtitle">Run cross-domain joins (finance + external datasets). SELECT/WITH only.</p>
        </div>
        <select className="query-history" defaultValue="">
          <option value="" disabled>Query history</option>
        </select>
      </div>
      <textarea className="sql-editor" value={query} onChange={(event) => setQuery(event.target.value)} rows={10} spellCheck={false} />
      <div className="section-head query-actions">
        <button className="ghost-btn" onClick={() => setQuery('')}>Clear</button>
        <button className="ghost-btn" onClick={runQuery}>Refresh</button>
        <button onClick={runQuery} disabled={isLoading}>{isLoading ? 'Running...' : 'Run Query'}</button>
      </div>
      {queryResult && (
        <div className="query-result">
          <div className="result-summary">
            <p className="muted">Rows returned: {queryResult.row_count}</p>
            <p className="muted">Available tables: {(queryResult.tables || []).join(', ')}</p>
          </div>
          <div className="result-split">
            <section className="result-panel">
              <h3>Query Results</h3>
              {queryResult.columns?.length > 0 && (
                <table>
                  <thead>
                    <tr>{queryResult.columns.map((col) => <th key={col}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(queryResult.rows || []).map((row, idx) => (
                      <tr key={idx}>
                        {queryResult.columns.map((col) => <td key={`${idx}-${col}`}>{String(row[col] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className="viz-panel">
              <h3>Visualization</h3>
              {!numericColumn ? (
                <div className="empty-state">Run a query with at least one numeric column to preview a bar chart.</div>
              ) : (
                <div className="bar-chart">
                  {chartRows.map((row, idx) => {
                    const value = Number(row[numericColumn] || 0)
                    const height = Math.max(10, Math.round((value / maxValue) * 120))
                    return (
                      <div className="bar-wrap" key={`bar-${idx}`}>
                        <div className="bar" style={{ height: `${height}px` }} />
                        <span>{String(row[labelColumn] ?? idx + 1).slice(0, 8)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  )
}
