/** @param {unknown[]} rows @param {number|'all'} limit */
export function sliceByRowLimit(rows, limit) {
  if (!Array.isArray(rows)) return []
  if (limit === 'all') return rows
  return rows.slice(0, limit)
}

/** @param {number} total @param {number|'all'} limit */
export function visibleRowCount(total, limit) {
  if (limit === 'all') return total
  return Math.min(limit, total)
}
