import './MiniBarChart.css'

export function MiniBarChart({ title, labels, values }) {
  const nums = (values || []).map((v) => Number(v) || 0)
  const max = Math.max(1, ...nums)
  const lbls = labels || []

  if (!lbls.length) {
    return (
      <div className="mini-bar-chart">
        <h4 className="mini-bar-chart-title">{title}</h4>
        <p className="mini-bar-chart-empty">No data</p>
      </div>
    )
  }

  return (
    <div className="mini-bar-chart">
      <h4 className="mini-bar-chart-title">{title}</h4>
      <div className="mini-bar-chart-bars">
        {lbls.map((label, i) => {
          const h = Math.round((nums[i] / max) * 100)
          return (
            <div className="mini-bar-chart-row" key={`${label}-${i}`}>
              <span className="mini-bar-chart-label" title={label}>
                {String(label).slice(0, 12)}
                {String(label).length > 12 ? '…' : ''}
              </span>
              <div className="mini-bar-chart-track">
                <div className="mini-bar-chart-fill" style={{ width: `${h}%` }} />
              </div>
              <span className="mini-bar-chart-num">{nums[i].toLocaleString()}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
