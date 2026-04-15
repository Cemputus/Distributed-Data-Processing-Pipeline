import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import { LoginPage } from './pages/LoginPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { UploadsPage } from './pages/UploadsPage'
import { DatasetsPage } from './pages/DatasetsPage'
import { ETLJobsPage } from './pages/ETLJobsPage'
import { QueryWorkspace } from './pages/QueryWorkspace'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { normalizeRequestError, readJsonSafe } from './utils/httpErrors'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const sectionsByRole = {
  admin: ['analytics', 'uploads', 'datasets', 'etl', 'query', 'bigquery', 'audit', 'users'],
  data_engineer: ['analytics', 'uploads', 'datasets', 'etl', 'query', 'bigquery', 'audit'],
  analyst: ['analytics', 'datasets', 'query', 'bigquery'],
  operator: ['analytics', 'uploads', 'datasets', 'etl'],
}

const menuItems = [
  { key: 'analytics', label: 'Dashboard' },
  { key: 'uploads', label: 'Uploads' },
  { key: 'datasets', label: 'Datasets' },
  { key: 'etl', label: 'ETL' },
  { key: 'query', label: 'Query' },
  { key: 'audit', label: 'Audit' },
  { key: 'users', label: 'Users' },
]

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState(null)
  const [activePage, setActivePage] = useState(localStorage.getItem('activePage') || 'analytics')
  const [state, setState] = useState({
    overview: null,
    merchants: [],
    uploadCatalog: { preloaded_dataset: 'dim_customers.csv', message: '' },
    uploadResult: null,
    successUploads: [],
    pendingLandings: [],
    failedUploads: [],
    datasets: [],
    etlJobs: [],
    queryResult: null,
    auditLogs: [],
    users: [],
    integrations: null,
    charts: null,
  })
  const [error, setError] = useState('')

  const allowedSections = useMemo(() => (user ? sectionsByRole[user.role] || [] : []), [user])
  const sidebarItems = useMemo(() => menuItems.filter((item) => allowedSections.includes(item.key)), [allowedSections])
  const activeLabel = sidebarItems.find((item) => item.key === activePage)?.label || 'Workspace'
  const roleLabel = user?.role ? user.role.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : ''

  function authHeaders() {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function apiGet(path) {
    try {
      const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
      const body = await readJsonSafe(response)
      if (!response.ok) {
        if (response.status === 403) throw new Error('')
        throw new Error(body.message || body.error || `Request failed: ${path}`)
      }
      return body
    } catch (err) {
      throw new Error(normalizeRequestError(err, `Request failed: ${path}`))
    }
  }

  async function apiPost(path, body, isForm = false) {
    try {
      const headers = isForm ? authHeaders() : { ...authHeaders(), 'Content-Type': 'application/json' }
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: isForm ? body : JSON.stringify(body || {}),
      })
      const payload = await readJsonSafe(response)
      if (!response.ok) {
        if (response.status === 403) throw new Error('')
        throw new Error(payload.message || payload.error || `Request failed: ${path}`)
      }
      return payload
    } catch (err) {
      throw new Error(normalizeRequestError(err, `Request failed: ${path}`))
    }
  }

  async function apiDelete(path) {
    try {
      const response = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() })
      const body = await readJsonSafe(response)
      if (!response.ok) {
        if (response.status === 403) throw new Error('')
        throw new Error(body.message || body.error || `Request failed: ${path}`)
      }
      return body
    } catch (err) {
      throw new Error(normalizeRequestError(err, `Request failed: ${path}`))
    }
  }

  async function refreshData() {
    if (!user) return
    setError('')
    try {
      const patch = {}
      if (allowedSections.includes('analytics')) {
        const [overview, merchants] = await Promise.all([
          apiGet('/api/overview'),
          apiGet('/api/top-merchants?limit=5'),
        ])
        patch.overview = overview
        patch.merchants = merchants.items || []
        try {
          patch.charts = await apiGet('/api/analytics/charts')
        } catch {
          patch.charts = null
        }
      }
      if (allowedSections.includes('uploads')) {
        const [catalog, success, pending, failed] = await Promise.all([
          apiGet('/api/upload-datasets'),
          apiGet('/api/uploads/success'),
          apiGet('/api/uploads/pending'),
          apiGet('/api/uploads/failed'),
        ])
        patch.uploadCatalog = catalog
        patch.successUploads = success.items || []
        patch.pendingLandings = pending.items || []
        patch.failedUploads = failed.items || []
      }
      if (allowedSections.includes('datasets')) {
        const datasets = await apiGet('/api/datasets')
        patch.datasets = datasets.items || []
      }
      if (allowedSections.includes('etl')) {
        const jobs = await apiGet('/api/etl/jobs')
        patch.etlJobs = jobs.items || []
      }
      if (allowedSections.includes('audit')) {
        const logs = await apiGet('/api/audit-logs')
        patch.auditLogs = logs.items || []
      }
      if (allowedSections.includes('users')) {
        const users = await apiGet('/api/users')
        patch.users = users.items || []
      }
      try {
        patch.integrations = await apiGet('/api/integrations/config')
      } catch {
        patch.integrations = null
      }
      setState((prev) => ({ ...prev, ...patch }))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    async function loadMe() {
      if (!token) return
      try {
        const meResponse = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
        const body = await readJsonSafe(meResponse)
        if (!meResponse.ok) throw new Error()
        setUser(body)
      } catch {
        setUser(null)
        setToken('')
        localStorage.removeItem('token')
      }
    }
    loadMe()
  }, [token])

  useEffect(() => {
    if (user) {
      if (activePage === 'bigquery') {
        setActivePage('query')
        localStorage.setItem('activePage', 'query')
      }
      if (!allowedSections.includes(activePage) && allowedSections.length > 0) {
        setActivePage(allowedSections[0])
      }
      refreshData()
    }
  }, [user, activePage, allowedSections.join('|')])

  async function handleLogin(credentials) {
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const body = await readJsonSafe(response)
      if (!response.ok) throw new Error(body.error || 'Login failed')
      localStorage.setItem('token', body.token)
      setToken(body.token)
      setUser({ username: body.username, role: body.role })
    } catch (err) {
      setError(normalizeRequestError(err, 'Login failed'))
    }
  }

  async function handleUpload(file) {
    try {
      const form = new FormData()
      form.append('file', file)
      const payload = await apiPost('/api/uploads', form, true)
      setState((prev) => ({ ...prev, uploadResult: payload }))
      await refreshData()
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  async function processDataset(mode, dataset, runEtl) {
    try {
      const body = { mode, run_etl: runEtl, job_name: 'post_preprocess_etl' }
      if (mode === 'single' && dataset) body.dataset = dataset
      await apiPost('/api/datasets/process', body)
      await refreshData()
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  async function triggerEtl(scope, datasetName) {
    try {
      const body = { job_name: 'etl-pipeline.py', scope: scope || 'delegate_only' }
      if (scope === 'preprocess_single' && datasetName) body.dataset = datasetName
      await apiPost('/api/etl/jobs', body)
      await refreshData()
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  async function createUser(payload) {
    try {
      await apiPost('/api/users', payload)
      await refreshData()
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  async function updateUser(username, payload) {
    try {
      const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(username)}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await readJsonSafe(response)
      if (!response.ok) {
        if (response.status === 403) return
        throw new Error(body.message || body.error || 'Update failed')
      }
      await refreshData()
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  async function runQuery(queryText) {
    try {
      setError('')
      const payload = await apiPost('/api/cen-query/execute', { query: queryText, row_limit: 250 })
      setState((prev) => ({ ...prev, queryResult: payload }))
    } catch (err) {
      if (err.message) setError(normalizeRequestError(err, 'Query failed'))
    }
  }

  async function deleteDataset(datasetName) {
    try {
      await apiDelete(`/api/datasets/${encodeURIComponent(datasetName)}`)
      await refreshData()
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  async function refreshWorkspace() {
    await refreshData()
  }

  function exportRows(filename, rows) {
    if (!rows || rows.length === 0) return
    const columns = Object.keys(rows[0])
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.join(','), ...rows.map((row) => columns.map((col) => escape(row[col])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleGlobalExport() {
    const exportMap = {
      analytics: ['top_merchants.csv', state.merchants],
      uploads: ['successful_uploads.csv', state.successUploads],
      datasets: ['datasets_catalog.csv', state.datasets],
      etl: ['etl_jobs.csv', state.etlJobs],
      audit: ['audit_logs.csv', state.auditLogs],
      users: ['users.csv', state.users],
    }
    const selected = exportMap[activePage]
    if (!selected) return
    exportRows(selected[0], selected[1])
  }

  function logout() {
    setToken('')
    setUser(null)
    setState((prev) => ({ ...prev, queryResult: null, uploadResult: null }))
    localStorage.removeItem('token')
  }

  if (!token || !user) {
    return <LoginPage error={error} onLogin={handleLogin} />
  }

  return (
    <main className="layout light-theme">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">CA</div>
          <div>
            <h2 className="app-brand-title">Console</h2>
          </div>
        </div>
        <p className="muted user-chip">{user.username} • {roleLabel}</p>
        <nav className="side-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              className={activePage === item.key ? 'active' : ''}
              onClick={() => {
                setActivePage(item.key)
                localStorage.setItem('activePage', item.key)
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={logout}>Logout</button>
      </aside>

      <section className="content">
        <div className="top-strip card">
          <div className="top-strip-left">
            <span className="crumb">Console</span>
            <span className="crumb-sep">/</span>
            <span className="crumb active">{activeLabel}</span>
          </div>
          <div className="top-strip-right">
            <button className="ghost-btn" onClick={refreshWorkspace}>Refresh</button>
            <button className="ghost-btn" onClick={handleGlobalExport}>Export</button>
            <button className="theme-pill">Light</button>
            <div className="avatar-chip">{(user.username || 'U').slice(0, 2).toUpperCase()}</div>
          </div>
        </div>
        <div className="content-header">
          <p className="eyebrow">Workspace</p>
          <h1>{activeLabel}</h1>
          <p className="subtitle">Data operations</p>
        </div>
        {error && <p className="error">{error}</p>}

        {activePage === 'analytics' && (
          <AnalyticsPage overview={state.overview} merchants={state.merchants} charts={state.charts} />
        )}
        {activePage === 'uploads' && (
          <UploadsPage
            catalog={state.uploadCatalog}
            uploadResult={state.uploadResult}
            successfulUploads={state.successUploads}
            pendingLandings={state.pendingLandings}
            failedUploads={state.failedUploads}
            integrations={state.integrations}
            onUpload={handleUpload}
            onProcessDataset={processDataset}
          />
        )}
        {activePage === 'datasets' && <DatasetsPage datasets={state.datasets} onDelete={deleteDataset} />}
        {activePage === 'etl' && (
          <ETLJobsPage
            jobs={state.etlJobs}
            onTrigger={triggerEtl}
            integrations={state.integrations}
            token={token}
          />
        )}
        {activePage === 'query' && (
          <QueryWorkspace
            queryResult={state.queryResult}
            onRunQuery={runQuery}
            token={token}
            showBigQuery={allowedSections.includes('bigquery')}
          />
        )}
        {activePage === 'audit' && <AuditLogsPage items={state.auditLogs} />}
        {activePage === 'users' && <UserManagementPage users={state.users} onCreate={createUser} onUpdate={updateUser} />}
      </section>
    </main>
  )
}

export default App
