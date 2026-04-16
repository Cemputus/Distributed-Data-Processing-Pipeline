import './MiniBarChart.css'

function barHue(index, offset = 0) {
  return (220 + (index + offset) * 34) % 360
}

export function MiniBarChart({ title, labels, values, layout = 'horizontal' }) {
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

  if (layout === 'vertical') {
    return (
      <div className="mini-bar-chart mini-bar-chart--vertical">
        <h4 className="mini-bar-chart-title">{title}</h4>
        <div className="mini-bar-chart-columns" role="img" aria-label={title}>
          {lbls.map((label, i) => {
            const h = Math.round((nums[i] / max) * 100)
            const hue = barHue(i, 2)
            return (
              <div className="mini-bar-chart-column" key={`${label}-${i}`}>
                <span className="mini-bar-chart-vnum">{nums[i].toLocaleString()}</span>
                <div className="mini-bar-chart-vtrack">
                  <div
                    className="mini-bar-chart-vfill"
                    style={{
                      height: `${h}%`,
                      background: `linear-gradient(180deg, hsl(${hue}, 72%, 52%), hsl(${hue}, 65%, 42%))`,
                    }}
                  />
                </div>
                <span className="mini-bar-chart-vlabel" title={label}>
                  {String(label).slice(0, 10)}
                  {String(label).length > 10 ? '…' : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mini-bar-chart mini-bar-chart--horizontal">
      <h4 className="mini-bar-chart-title">{title}</h4>
      <div className="mini-bar-chart-bars">
        {lbls.map((label, i) => {
          const h = Math.round((nums[i] / max) * 100)
          const hue = barHue(i, 0)
          return (
            <div className="mini-bar-chart-row" key={`${label}-${i}`}>
              <span className="mini-bar-chart-label" title={label}>
                {String(label).slice(0, 14)}
                {String(label).length > 14 ? '…' : ''}
              </span>
              <div className="mini-bar-chart-track">
                <div
                  className="mini-bar-chart-fill"
                  style={{
                    width: `${h}%`,
                    background: `linear-gradient(90deg, hsl(${hue}, 70%, 52%), hsl(${hue}, 65%, 44%))`,
                  }}
                />
              </div>
              <span className="mini-bar-chart-num">{nums[i].toLocaleString()}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
