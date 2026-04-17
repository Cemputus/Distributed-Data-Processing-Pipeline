import './BarChart.css'

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function niceMax(max) {
  const m = Math.max(1, max)
  const pow = Math.pow(10, Math.floor(Math.log10(m)))
  const r = m / pow
  const step = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10
  return step * pow
}

function formatCompact(n) {
  try {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  } catch {
    return String(n)
  }
}

export function BarChart({ title, labels, values, layout = 'vertical', palette = 'blueGreen' }) {
  const lbls = (labels || []).map((x) => String(x ?? ''))
  const nums = (values || []).map((v) => toNum(v))
  const rows = lbls.map((l, i) => ({ label: l, value: nums[i] ?? 0 })).filter((x) => x.label)
  const data = rows.slice(0, layout === 'vertical' ? 12 : 16)

  if (!data.length) {
    return (
      <div className="bar-chart">
        <h4 className="bar-chart-title">{title}</h4>
        <p className="bar-chart-empty">No data</p>
      </div>
    )
  }

  const max = niceMax(Math.max(1, ...data.map((d) => d.value)))
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max]

  if (layout === 'horizontal') {
    const W = 640
    const H = 260
    const padL = 130
    const padR = 18
    const padT = 14
    const padB = 34
    const innerW = W - padL - padR
    const innerH = H - padT - padB
    const rowH = innerH / data.length
    const barH = clamp(rowH * 0.62, 10, 18)

    return (
      <div className={`bar-chart bar-chart--${palette}`}>
        <h4 className="bar-chart-title">{title}</h4>
        <div className="bar-chart-svg-wrap" role="img" aria-label={title}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {/* grid + x ticks */}
            {ticks.map((t) => {
              const x = padL + (t / max) * innerW
              return (
                <g key={t}>
                  <line className="bar-chart-grid" x1={x} y1={padT} x2={x} y2={padT + innerH} />
                  <text className="bar-chart-tick" x={x} y={padT + innerH + 22} textAnchor="middle">
                    {formatCompact(Math.round(t))}
                  </text>
                </g>
              )
            })}

            {/* baseline */}
            <line className="bar-chart-axis" x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} />

            {data.map((d, i) => {
              const yMid = padT + i * rowH + rowH / 2
              const y = yMid - barH / 2
              const w = (d.value / max) * innerW
              const fill = i % 2 === 0 ? 'bar-a' : 'bar-b'
              return (
                <g key={`${d.label}-${i}`} className="bar-chart-row">
                  <text className="bar-chart-label" x={padL - 10} y={yMid + 4} textAnchor="end">
                    {d.label.length > 22 ? `${d.label.slice(0, 20)}…` : d.label}
                  </text>
                  <rect
                    className={`bar-chart-bar ${fill}`}
                    x={padL}
                    y={y}
                    width={Math.max(1.5, w)}
                    height={barH}
                    rx={6}
                    ry={6}
                  >
                    <title>{`${d.label}: ${d.value.toLocaleString()}`}</title>
                  </rect>
                  <text className="bar-chart-value" x={padL + innerW} y={yMid + 4} textAnchor="end">
                    {formatCompact(d.value)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    )
  }

  // vertical
  const W = 640
  const H = 300
  const padL = 44
  const padR = 18
  const padT = 18
  const padB = 78
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const colW = innerW / data.length
  const barW = clamp(colW * 0.62, 12, 44)

  return (
    <div className={`bar-chart bar-chart--${palette}`}>
      <h4 className="bar-chart-title">{title}</h4>
      <div className="bar-chart-svg-wrap" role="img" aria-label={title}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {/* y grid + ticks */}
          {ticks.map((t) => {
            const y = padT + innerH - (t / max) * innerH
            return (
              <g key={t}>
                <line className="bar-chart-grid" x1={padL} y1={y} x2={padL + innerW} y2={y} />
                <text className="bar-chart-tick" x={padL - 8} y={y + 4} textAnchor="end">
                  {formatCompact(Math.round(t))}
                </text>
              </g>
            )
          })}

          {/* baseline */}
          <line className="bar-chart-axis" x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} />

          {data.map((d, i) => {
            const xMid = padL + i * colW + colW / 2
            const h = (d.value / max) * innerH
            const y = padT + innerH - h
            const fill = i % 2 === 0 ? 'bar-a' : 'bar-b'
            return (
              <g key={`${d.label}-${i}`} className="bar-chart-col">
                <rect
                  className={`bar-chart-bar ${fill}`}
                  x={xMid - barW / 2}
                  y={y}
                  width={barW}
                  height={Math.max(1.5, h)}
                  rx={8}
                  ry={8}
                >
                  <title>{`${d.label}: ${d.value.toLocaleString()}`}</title>
                </rect>
                <text className="bar-chart-xlabel" x={xMid} y={padT + innerH + 18} textAnchor="middle">
                  {d.label.length > 12 ? `${d.label.slice(0, 10)}…` : d.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

