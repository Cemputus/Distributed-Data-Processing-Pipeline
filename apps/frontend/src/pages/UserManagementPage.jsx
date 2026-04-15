import { useMemo, useState } from 'react'
import './UserManagementPage.css'

export function UserManagementPage({ users, onCreate, onUpdate }) {
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ username: '', password: '', role: 'analyst' })
  const [error, setError] = useState('')

  const filteredUsers = useMemo(
    () => users.filter((item) => item.username.toLowerCase().includes(query.toLowerCase())),
    [users, query],
  )

  async function submitCreate(event) {
    event.preventDefault()
    setError('')
    try {
      await onCreate(form)
      setForm({ username: '', password: '', role: 'analyst' })
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  async function toggleEnabled(user) {
    try {
      await onUpdate(user.username, { enabled: !user.enabled })
    } catch (err) {
      if (err.message) setError(err.message)
    }
  }

  return (
    <section className="card users-page">
      <div className="section-head">
        <h2>User Management</h2>
        <input placeholder="Filter users..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      <form className="user-create-form" onSubmit={submitCreate}>
        <input placeholder="username" value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} />
        <input placeholder="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} />
        <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
          <option value="admin">admin</option>
          <option value="data_engineer">data_engineer</option>
          <option value="analyst">analyst</option>
          <option value="operator">operator</option>
        </select>
        <button type="submit">Add User</button>
      </form>

      {filteredUsers.length === 0 ? (
        <div className="empty-state">No users found.</div>
      ) : (
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Enabled</th><th>Action</th></tr></thead>
          <tbody>
            {filteredUsers.map((item) => (
              <tr key={item.username}>
                <td>{item.username}</td>
                <td>{item.role}</td>
                <td><span className={`status-pill ${item.enabled ? 'success' : 'failed'}`}>{item.enabled ? 'enabled' : 'disabled'}</span></td>
                <td><button className="ghost-btn" onClick={() => toggleEnabled(item)}>{item.enabled ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
