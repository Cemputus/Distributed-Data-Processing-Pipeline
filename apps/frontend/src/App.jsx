import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import { LoginPage } from './pages/LoginPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { UploadsPage } from './pages/UploadsPage'
import { DatasetsPage } from './pages/DatasetsPage'
import { ETLJobsPage } from './pages/ETLJobsPage'
import { CENQueryPage } from './pages/CENQueryPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { BigQueryPage } from './pages/BigQueryPage'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const sectionsByRole = {
  admin: ['analytics', 'uploads', 'datasets', 'etl', 'query', 'bigquery', 'audit', 'users'],
  data_engineer: ['analytics', 'uploads', 'datasets', 'etl', 'query', 'bigquery', 'audit'],
  analyst: ['analytics', 'datasets', 'query', 'bigquery'],
  operator: ['analytics', 'uploads', 'datasets', 'etl'],
}

const menuItems = [
  { key: 'analytics', label: 'Dashboard' },
  { key: 'uploads', label: 'Upload' },
  { key: 'datasets', label: 'Datasets & Insights' },
  { key: 'etl', label: 'ETL Jobs' },
  { key: 'query', label: 'CEN Query' },
  { key: 'bigquery', label: 'BigQuery' },
  { key: 'audit', label: 'Audit Logs' },
  { key: 'users', label: 'User Management' },
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
    failedUploads: [],
    datasets: [],
    etlJobs: [],
    queryResult: null,
    auditLogs: [],
    users: [],
    integrations: null,
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
    const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
    const body = await response.json()
    if (!response.ok) {
      if (response.status === 403) throw new Error('')
      throw new Error(body.message || body.error || `Request failed: ${path}`)
    }
    return body
  }

  async function apiPost(path, body, isForm = false) {
    const headers = isForm ? authHeaders() : { ...authHeaders(), 'Content-Type': 'application/json' }
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: isForm ? body : JSON.stringify(body || {}),
    })
    const payload = await response.json()
    if (!response.ok) {
      if (response.status === 403) throw new Error('')
      throw new Error(payload.message || payload.error || `Request failed: ${path}`)
    }
    return payload
  }

  async function refreshData() {
    if (!user) return
    setError('')
    try {
      const patch = {}
      if (allowedSections.includes('analytics')) {
        const [overview, merchants] = await Promise.all([apiGet('/api/overview'), apiGet('/api/top-merchants?limit=5')])
        patch.overview = overview
        patch.merchants = merchants.items || []
      }
      if (allowedSections.includes('uploads')) {
        const [catalog, success, failed] = await Promise.all([apiGet('/api/upload-datasets'), apiGet('/api/uploads/success'), apiGet('/api/uploads/failed')])
        patch.uploadCatalog = catalog
        patch.successUploads = success.items || []
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
        const body = await meResponse.json()
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
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Login failed')
      localStorage.setItem('token', body.token)
      setToken(body.token)
      setUser({ username: body.username, role: body.role })
    } catch (err) {
      setError(err.message)
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

  async function triggerEtl() {
    try {
      await apiPost('/api/etl/jobs', { job_name: 'etl-pipeline.py' })
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
      const body = await response.json()
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
      const payload = await apiPost('/api/cen-query/execute', { query: queryText, row_limit: 250 })
      setState((prev) => ({ ...prev, queryResult: payload }))
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
            <h2>CENAnalytics</h2>
            <p className="muted">Data Architects</p>
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
          <p className="eyebrow">CENAnalytics</p>
          <h1>{activeLabel}</h1>
          <p className="subtitle">Enterprise data operations console with delegated ETL, dynamic ingestion, and governed analytics.</p>
        </div>
        {error && <p className="error">{error}</p>}

        {activePage === 'analytics' && <AnalyticsPage overview={state.overview} merchants={state.merchants} />}
        {activePage === 'uploads' && (
          <UploadsPage
            catalog={state.uploadCatalog}
            uploadResult={state.uploadResult}
            successfulUploads={state.successUploads}
            failedUploads={state.failedUploads}
            onUpload={handleUpload}
          />
        )}
        {activePage === 'datasets' && <DatasetsPage datasets={state.datasets} />}
        {activePage === 'etl' && (
          <ETLJobsPage jobs={state.etlJobs} onTrigger={triggerEtl} integrations={state.integrations} />
        )}
        {activePage === 'query' && <CENQueryPage queryResult={state.queryResult} onRunQuery={runQuery} />}
        {activePage === 'bigquery' && <BigQueryPage token={token} />}
        {activePage === 'audit' && <AuditLogsPage items={state.auditLogs} />}
        {activePage === 'users' && <UserManagementPage users={state.users} onCreate={createUser} onUpdate={updateUser} />}
      </section>
    </main>
  )
}

export default App
