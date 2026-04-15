const OPTIONS = [10, 20, 30, 50, 100, 200, 'all']

/**
 * @param {{ value: number | 'all', onChange: (v: number | 'all') => void, id?: string, label?: string }} props
 */
export function RowsPerPageSelect({ value, onChange, id = 'rows-per-page', label = 'Rows' }) {
  const strVal = value === 'all' ? 'all' : String(value)
  return (
    <label className="rows-per-page-control" htmlFor={id}>
      <span className="rows-per-page-label">{label}</span>
      <select
        id={id}
        value={strVal}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === 'all' ? 'all' : Number(v))
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o === 'all' ? 'all' : o}>
            {o === 'all' ? 'All' : o}
          </option>
        ))}
      </select>
    </label>
  )
}
