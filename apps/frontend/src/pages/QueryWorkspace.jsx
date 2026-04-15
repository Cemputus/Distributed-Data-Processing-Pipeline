import { useEffect, useState } from 'react'
import { CENQueryPage } from './CENQueryPage'
import { BigQueryPage } from './BigQueryPage'
import './QueryWorkspace.css'

const TAB_KEY = 'queryWorkspaceTab'

export function QueryWorkspace({ queryResult, onRunQuery, token, showBigQuery }) {
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem(TAB_KEY)
    if (saved === 'bq' && showBigQuery) return 'bq'
    return 'csv'
  })

  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab)
  }, [tab])

  useEffect(() => {
    if (tab === 'bq' && !showBigQuery) setTab('csv')
  }, [showBigQuery, tab])

  return (
    <div className="query-workspace">
      <div className="query-workspace-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === 'csv' ? 'active' : ''}
          aria-selected={tab === 'csv'}
          onClick={() => setTab('csv')}
        >
          CSV · SQL
        </button>
        {showBigQuery ? (
          <button
            type="button"
            role="tab"
            className={tab === 'bq' ? 'active' : ''}
            aria-selected={tab === 'bq'}
            onClick={() => setTab('bq')}
          >
            BigQuery
          </button>
        ) : null}
      </div>
      <div className="query-workspace-panel" role="tabpanel">
        {tab === 'csv' && <CENQueryPage queryResult={queryResult} onRunQuery={onRunQuery} />}
        {tab === 'bq' && showBigQuery && <BigQueryPage token={token} embedded />}
      </div>
    </div>
  )
}
