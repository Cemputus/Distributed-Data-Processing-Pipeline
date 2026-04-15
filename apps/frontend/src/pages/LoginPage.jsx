import { useState } from 'react'
import './LoginPage.css'

export function LoginPage({ error, onLogin }) {
  const [form, setForm] = useState({ username: 'engineer', password: 'engineer123' })

  async function handleSubmit(event) {
    event.preventDefault()
    await onLogin(form)
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="hero-top">
          <div className="hero-logo">
            <span>CA</span>
          </div>
          <div className="hero-pill">CENAnalytics</div>
        </div>
        <h1>CENAnalytics</h1>
        <p>
          Distributed data processing, governed ingestion, and analytics in one workspace.
        </p>
        <div className="hero-security">Secure sign-in. Your data stays protected.</div>
        <p className="hero-footer">© 2026 CENAnalytics</p>
      </section>

      <section className="login-panel">
        <h2>Sign in</h2>
        <p className="hint">Use your role account to access scoped capabilities.</p>
        {error && <p className="login-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </label>
          <button type="submit">Sign in</button>
        </form>
        <p className="hint demo">
          Demo roles: admin/admin123, engineer/engineer123, analyst/analyst123, operator/operator123
        </p>
      </section>
    </main>
  )
}
