import { useEffect, useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './CENQueryPage.css'

export function CENQueryPage({ queryResult, onRunQuery }) {
  const [query, setQuery] = useState(localStorage.getItem('cenquery:lastQuery') || 'SELECT c.customer_id, c.full_name, a.account_id FROM dim_customers c LEFT JOIN dim_accounts a ON c.customer_id = a.customer_id LIMIT 20')
  const [isLoading, setIsLoading] = useState(false)
  const [rowLimit, setRowLimit] = useState(20)
  const [resultFilter, setResultFilter] = useState('')
  const [filterColumn, setFilterColumn] = useState('')

  const columns = queryResult?.columns || []
  const allRows = queryResult?.rows || []

  const filteredRows = useMemo(() => {
    const needle = resultFilter.trim().toLowerCase()
    if (!needle) return allRows
    const cols = filterColumn && columns.includes(filterColumn) ? [filterColumn] : columns
    return allRows.filter((row) => cols.some((col) => String(row[col] ?? '').toLowerCase().includes(needle)))
  }, [allRows, columns, resultFilter, filterColumn])

  const displayRows = useMemo(() => sliceByRowLimit(filteredRows, rowLimit), [filteredRows, rowLimit])

  const numericColumn = columns.find((col) => {
    const sample = allRows.find((row) => typeof row[col] === 'number')
    return typeof sample?.[col] === 'number'
  })
  const labelColumn = columns[0]
  const chartRows = useMemo(() => displayRows.slice(0, 14), [displayRows])
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
            {allRows.length > 0 && (
              <div className="section-head-controls query-result-rows-control">
                <RowsPerPageSelect value={rowLimit} onChange={setRowLimit} id="cen-query-rows" label="Table rows" />
              </div>
            )}
          </div>
          {columns.length > 0 && allRows.length > 0 && (
            <div className="result-filters card">
              <div className="result-filters-row">
                <label className="result-filter-field">
                  <span className="muted">Filter results</span>
                  <input
                    type="search"
                    className="result-filter-input"
                    placeholder="Type to match any cell…"
                    value={resultFilter}
                    onChange={(e) => setResultFilter(e.target.value)}
                    aria-label="Filter query result rows"
                  />
                </label>
                <label className="result-filter-field result-filter-field--narrow">
                  <span className="muted">Column scope</span>
                  <select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} aria-label="Limit filter to one column">
                    <option value="">All columns</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                {(resultFilter || filterColumn) && (
                  <button type="button" className="ghost-btn result-filter-clear" onClick={() => { setResultFilter(''); setFilterColumn('') }}>
                    Clear filters
                  </button>
                )}
              </div>
              <p className="muted result-filter-hint">
                Client-side filter on the result set (does not re-run SQL). Matches substrings, case-insensitive.
              </p>
            </div>
          )}
          <div className="result-split">
            <section className="result-panel">
              <h3>Query Results</h3>
              {columns.length > 0 && (
                <table>
                  <thead>
                    <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row, idx) => (
                      <tr key={idx}>
                        {columns.map((col) => <td key={`${idx}-${col}`}>{String(row[col] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {allRows.length > 0 && (
                <p className="muted table-meta">
                  Showing {visibleRowCount(filteredRows.length, rowLimit)} of {filteredRows.length} rows
                  {filteredRows.length !== allRows.length ? ` (${allRows.length} total from query)` : ' in this view'}
                </p>
              )}
              {allRows.length > 0 && filteredRows.length === 0 && (
                <p className="muted table-meta">No rows match the current filters.</p>
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
