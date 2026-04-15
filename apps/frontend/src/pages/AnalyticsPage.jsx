import { useMemo, useState } from 'react'
import { MiniBarChart } from '../components/MiniBarChart'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './AnalyticsPage.css'

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0)
}

export function AnalyticsPage({ overview, merchants, charts }) {
  const [query, setQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(20)
  const filteredMerchants = useMemo(
    () => merchants.filter((item) => item.merchant_name.toLowerCase().includes(query.toLowerCase())),
    [merchants, query],
  )
  const displayedMerchants = useMemo(() => sliceByRowLimit(filteredMerchants, rowLimit), [filteredMerchants, rowLimit])

  if (!overview) {
    return <p className="page-caption">Loading…</p>
  }

  const chartList = charts?.charts || []
  const dataRoot = overview.data_dir || charts?.data_dir

  return (
    <div className="analytics-page">
      <p className="page-caption analytics-gate-note">
        KPIs and the “Top merchants” table read CSVs directly under the backend <strong>data directory</strong> (same as
        CEN Query: <code>dim_customers.csv</code>, <code>dim_accounts.csv</code>, <code>fact_transactions.csv</code>,{' '}
        <code>fact_loans.csv</code>, <code>fact_fraud_alerts.csv</code>, <code>dim_merchants.csv</code>). Gated files use
        an <code>analytics_ready</code> marker in <code>uploads/activated/</code> when present, or a non-empty file at
        that path. Charts reuse the same transaction/merchant/loan/fraud files; upload-day and pipeline charts use{' '}
        <code>dataset_registry.json</code>.
      </p>
      {dataRoot && (
        <p className="muted analytics-data-root">
          <strong>Resolved DATA_DIR:</strong> <code className="analytics-path">{dataRoot}</code>
        </p>
      )}
      {overview.kpi_sources && (
        <details className="analytics-kpi-sources muted">
          <summary className="analytics-kpi-summary">KPI source files (paths the API used)</summary>
          <ul className="analytics-kpi-list">
            {Object.entries(overview.kpi_sources).map(([name, meta]) => (
              <li key={name}>
                <code>{name}</code>
                {meta.analytics_ready ? (
                  <span> · analytics_ready</span>
                ) : (
                  <span> · no marker (file on disk still counts if non-empty)</span>
                )}
                <div>
                  <code className="analytics-path">{meta.path}</code>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className="grid">
        <article className="card"><h2>Customers</h2><p>{formatNumber(overview.customers)}</p></article>
        <article className="card"><h2>Accounts</h2><p>{formatNumber(overview.accounts)}</p></article>
        <article className="card"><h2>Transactions</h2><p>{formatNumber(overview.transactions)}</p></article>
        <article className="card"><h2>Loans</h2><p>{formatNumber(overview.loans)}</p></article>
        <article className="card"><h2>Fraud alerts</h2><p>{formatNumber(overview.fraud_alerts)}</p></article>
        <article className="card"><h2>Tx volume (UGX)</h2><p>{formatNumber(overview.transaction_volume_ugx)}</p></article>
        <article className="card"><h2>Loan principal (UGX)</h2><p>{formatNumber(overview.loan_principal_ugx)}</p></article>
      </section>

      {chartList.length > 0 ? (
        <section className="dashboard-charts card">
          <h2 className="dashboard-charts-heading">Charts</h2>
          <div className="dashboard-charts-grid">
            {chartList.map((c) => (
              <article key={c.key} className="dashboard-chart-card card">
                <MiniBarChart title={c.title} labels={c.labels || []} values={c.values || []} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card merchants-panel">
        <div className="section-head">
          <h2>Top merchants</h2>
          <div className="section-head-controls">
            <input placeholder="Filter merchant…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <RowsPerPageSelect value={rowLimit} onChange={setRowLimit} id="analytics-merchants-rows" />
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Merchant</th><th>Transactions</th><th>Total amount (UGX)</th></tr>
          </thead>
          <tbody>
            {displayedMerchants.map((item) => (
              <tr key={item.merchant_id}>
                <td>{item.merchant_name}</td>
                <td>{formatNumber(item.transaction_count)}</td>
                <td>{formatNumber(item.total_amount_ugx)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredMerchants.length > 0 && (
          <p className="muted table-meta">
            Showing {visibleRowCount(filteredMerchants.length, rowLimit)} of {filteredMerchants.length} merchants
          </p>
        )}
      </section>
    </div>
  )
}
