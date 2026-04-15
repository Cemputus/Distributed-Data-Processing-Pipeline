/** Stable JSON parse for API error bodies (avoids throw if server returns HTML). */
export async function readJsonSafe(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

/** Human-friendly message for network failures (matches App.jsx behavior). */
export function normalizeRequestError(err, fallback = 'Request failed') {
  const raw = String(err?.message || '').trim()
  const message = raw.toLowerCase()
  if (!raw) return fallback
  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')) {
    return 'Unable to reach the backend service. Please ensure the API is running and try again.'
  }
  return raw
}
