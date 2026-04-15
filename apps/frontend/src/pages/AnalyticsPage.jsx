import { useMemo, useState } from 'react'
import { RowsPerPageSelect } from '../components/RowsPerPageSelect'
import { sliceByRowLimit, visibleRowCount } from '../utils/tableRows'
import './AnalyticsPage.css'

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0)
}

export function AnalyticsPage({ overview, merchants }) {
  const [query, setQuery] = useState('')
  const [rowLimit, setRowLimit] = useState(20)
  const filteredMerchants = useMemo(
    () => merchants.filter((item) => item.merchant_name.toLowerCase().includes(query.toLowerCase())),
    [merchants, query],
  )
  const displayedMerchants = useMemo(() => sliceByRowLimit(filteredMerchants, rowLimit), [filteredMerchants, rowLimit])

  if (!overview) {
    return <p>Loading analytics...</p>
  }

  return (
    <div className="analytics-page">
      <section className="grid">
        <article className="card"><h2>Customers</h2><p>{formatNumber(overview.customers)}</p></article>
        <article className="card"><h2>Accounts</h2><p>{formatNumber(overview.accounts)}</p></article>
        <article className="card"><h2>Transactions</h2><p>{formatNumber(overview.transactions)}</p></article>
        <article className="card"><h2>Loans</h2><p>{formatNumber(overview.loans)}</p></article>
        <article className="card"><h2>Fraud Alerts</h2><p>{formatNumber(overview.fraud_alerts)}</p></article>
        <article className="card"><h2>Transaction Volume (UGX)</h2><p>{formatNumber(overview.transaction_volume_ugx)}</p></article>
        <article className="card"><h2>Loan Principal (UGX)</h2><p>{formatNumber(overview.loan_principal_ugx)}</p></article>
      </section>

      <section className="card merchants-panel">
        <div className="section-head">
          <h2>Top Merchants</h2>
          <div className="section-head-controls">
            <input placeholder="Filter merchant..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <RowsPerPageSelect value={rowLimit} onChange={setRowLimit} id="analytics-merchants-rows" />
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Merchant</th><th>Transactions</th><th>Total Amount (UGX)</th></tr>
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
