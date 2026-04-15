import { useState } from 'react'
import {
  Apple,
  CalendarDays,
  ChevronDown,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react'

function GoogleGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function DashboardMockup() {
  const rows = [
    { name: 'Marketing', status: 'ok', pct: 92, bar: 92 },
    { name: 'Customer Success', status: 'warn', pct: 64, bar: 64 },
    { name: 'Dev Team', status: 'ok', pct: 88, bar: 88 },
    { name: 'Operations', status: 'bad', pct: 41, bar: 41 },
  ]

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,340px)] px-1 text-[9px] leading-tight text-slate-600">
      <div className="rounded-[14px] border border-slate-100/90 bg-white p-2.5 pb-2 shadow-[0_18px_40px_rgba(15,23,42,0.14),0_4px_12px_rgba(15,23,42,0.08)]">
        <div className="mb-2 flex items-start justify-between gap-1">
          <div>
            <p className="text-[11px] font-semibold tracking-tight text-slate-900">Dashboard</p>
            <p className="mt-0.5 text-[8px] text-slate-400">cen analytics · live</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white px-2 py-0.5 text-[8px] font-medium text-slate-600 shadow-sm"
            >
              Teams
              <ChevronDown className="h-2.5 w-2.5 text-slate-400" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white px-2 py-0.5 text-[8px] font-medium text-slate-600 shadow-sm"
            >
              <CalendarDays className="h-2.5 w-2.5 text-slate-400" strokeWidth={2} />
              Q2
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[8px] font-medium text-white shadow-sm"
            >
              <Plus className="h-2.5 w-2.5" strokeWidth={2} />
              Add
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
            <p className="text-[8px] font-medium text-slate-500">Productive time / day</p>
            <p className="mt-0.5 text-[15px] font-bold tracking-tight text-slate-900">12.4h</p>
            <svg className="mt-1 h-7 w-full" viewBox="0 0 120 32" preserveAspectRatio="none">
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 24 L20 18 L40 22 L60 10 L80 14 L100 8 L120 12 L120 32 L0 32 Z"
                fill="url(#g1)"
              />
              <path
                d="M0 24 L20 18 L40 22 L60 10 L80 14 L100 8 L120 12"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
            <p className="text-[8px] font-medium text-slate-500">Focused time</p>
            <p className="mt-0.5 text-[15px] font-bold tracking-tight text-slate-900">8.5h</p>
            <div className="mt-2 flex h-7 items-end gap-0.5">
              {[40, 55, 48, 62, 58, 70, 66, 74, 68, 80].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-indigo-200 to-indigo-500"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[9px] font-semibold text-slate-800">Team utilization</p>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <div className="grid grid-cols-[1fr_auto_52px] gap-x-1 border-b border-slate-100 bg-slate-50/90 px-2 py-1 text-[7px] font-semibold uppercase tracking-wide text-slate-400">
              <span>Team</span>
              <span className="text-center">Status</span>
              <span className="text-right">%</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.name}
                className="grid grid-cols-[1fr_auto_52px] items-center gap-x-1 border-b border-slate-50 px-2 py-1 last:border-b-0"
              >
                <span className="truncate text-[8px] font-medium text-slate-700">{r.name}</span>
                <span
                  className={
                    r.status === 'ok'
                      ? 'rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-semibold text-emerald-700 ring-1 ring-emerald-100'
                      : r.status === 'warn'
                        ? 'rounded-full bg-amber-50 px-1.5 py-0.5 text-[7px] font-semibold text-amber-800 ring-1 ring-amber-100'
                        : 'rounded-full bg-rose-50 px-1.5 py-0.5 text-[7px] font-semibold text-rose-700 ring-1 ring-rose-100'
                  }
                >
                  {r.status === 'ok' ? 'Healthy' : r.status === 'warn' ? 'Watch' : 'Risk'}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[8px] font-semibold text-slate-800">{r.pct}%</span>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={
                        r.status === 'bad'
                          ? 'h-full rounded-full bg-rose-400'
                          : 'h-full rounded-full bg-indigo-500'
                      }
                      style={{ width: `${r.bar}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="absolute -right-0 top-[52px] z-10 w-[128px] rounded-xl border border-slate-100/90 bg-white p-2 shadow-[0_14px_28px_rgba(15,23,42,0.12)] sm:-right-1"
        style={{ transform: 'translateX(4px)' }}
      >
        <div className="mb-1.5 flex items-center justify-between gap-1">
          <p className="text-[9px] font-semibold text-slate-800">Add member</p>
          <UserPlus className="h-3 w-3 text-slate-400" strokeWidth={2} />
        </div>
        <div className="relative mb-1.5">
          <Search className="pointer-events-none absolute left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <div className="rounded-md border border-slate-200 bg-slate-50 py-1 pl-6 pr-1.5 text-[7px] text-slate-400">
            Search people…
          </div>
        </div>
        <button
          type="button"
          className="mb-1.5 w-full rounded-md bg-slate-900 py-1 text-[8px] font-semibold text-white shadow-sm"
        >
          Invite
        </button>
        <ul className="space-y-1">
          {[
            { n: 'Alex Kim', r: 'Owner', ab: 'AK' },
            { n: 'Priya N.', r: 'Editor', ab: 'PN' },
            { n: 'Jordan Lee', r: 'Editor', ab: 'JL' },
          ].map((u) => (
            <li key={u.n} className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[7px] font-bold text-indigo-700">
                {u.ab}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-medium text-slate-800">{u.n}</p>
                <p className="text-[7px] text-slate-400">{u.r}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function LoginPage({ error, onLogin }) {
  const [form, setForm] = useState({
    name: '',
    username: 'engineer',
    password: 'engineer123',
  })
  const [agree, setAgree] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLocalError('')
    if (!agree) {
      setLocalError('Please agree to the Terms & Privacy to continue.')
      return
    }
    await onLogin({ username: form.username.trim(), password: form.password })
  }

  const displayError = error || localError

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#d9d9e2] p-4 font-sans antialiased sm:p-6">
      <div className="w-full max-w-[960px] overflow-hidden rounded-[22px] bg-white shadow-[0_22px_48px_rgba(15,23,42,0.12),0_6px_16px_rgba(15,23,42,0.06)]">
        <div className="flex min-h-[min(100vh-2rem,640px)] flex-col lg:min-h-[560px] lg:flex-row">
          {/* Left — form */}
          <div className="flex w-full flex-col border-b border-slate-100/80 bg-white px-7 py-9 sm:px-10 sm:py-10 lg:w-[48%] lg:border-b-0 lg:border-r lg:border-slate-100/80">
            <div className="mb-7 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#0f172a] text-white shadow-sm">
                <Layers className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </div>
            </div>

            <h1 className="text-[1.65rem] font-bold tracking-tight text-[#0f172a] sm:text-[1.75rem]">
              Get Started Now
            </h1>
            <p className="mt-1.5 text-[0.9375rem] text-slate-500">Enter your credentials to access your account</p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <button
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white text-[0.8125rem] font-medium text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] transition hover:bg-slate-50"
              >
                <GoogleGlyph className="h-[18px] w-[18px] shrink-0" />
                Log in with Google
              </button>
              <button
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white text-[0.8125rem] font-medium text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] transition hover:bg-slate-50"
              >
                <Apple className="h-[18px] w-[18px] shrink-0 text-slate-900" strokeWidth={1.75} />
                Log in with Apple
              </button>
            </div>

            <div className="relative my-7">
              <div className="border-t border-slate-200/90" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs font-medium text-slate-400">
                or
              </span>
            </div>

            <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="auth-name" className="mb-1.5 block text-xs font-medium text-slate-500">
                    Name
                  </label>
                  <input
                    id="auth-name"
                    autoComplete="name"
                    placeholder="Rafiqur Rahman"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200/95 bg-white px-3.5 text-[0.9375rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4452f2]/25 focus:border-[#4452f2]"
                  />
                </div>
                <div>
                  <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium text-slate-500">
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    autoComplete="username"
                    placeholder="rafiqur51@company.com"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200/95 bg-white px-3.5 text-[0.9375rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4452f2]/40 focus:ring-offset-0 focus:border-[#4452f2] focus:shadow-[0_0_0_3px_rgba(68,82,242,0.18)]"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="auth-password" className="text-xs font-medium text-slate-500">
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#4452f2] hover:underline"
                      onClick={(e) => e.preventDefault()}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      autoComplete="current-password"
                      placeholder="min 8 chars"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200/95 bg-white py-2 pl-3.5 pr-11 text-[0.9375rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4452f2]/25 focus:border-[#4452f2]"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[0.8125rem] text-slate-600">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#4452f2] focus:ring-[#4452f2]"
                />
                <span>
                  I agree to the{' '}
                  <button type="button" className="font-semibold text-[#4452f2] underline decoration-[#4452f2]/40 underline-offset-2 hover:opacity-90">
                    Terms & Privacy
                  </button>
                </span>
              </label>

              {displayError && (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                  {displayError}
                </p>
              )}

              <button
                type="submit"
                className="mt-6 h-12 w-full rounded-full bg-[#4452f2] text-[0.9375rem] font-semibold text-white shadow-[0_8px_24px_rgba(68,82,242,0.35)] transition hover:bg-[#3d49d9] active:scale-[0.99]"
              >
                Login
              </button>
            </form>

            <p className="mt-6 text-center text-[0.8125rem] text-slate-600">
              Have an account ?{' '}
              <button type="button" className="font-semibold text-[#4452f2] hover:underline">
                Sign in
              </button>
            </p>

            <p className="mt-auto pt-8 text-center text-[11px] text-slate-400">
              © 2026 cen analytics. All rights reserved.
            </p>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-400">
              Demo: use username in the email field (e.g. engineer) with your password — admin, analyst, operator roles supported.
            </p>
          </div>

          {/* Right — promo + mockup */}
          <div className="relative flex w-full flex-col overflow-x-hidden overflow-y-visible bg-[#4452f2] px-6 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-12 lg:w-[52%] lg:rounded-none">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
            <div className="pointer-events-none absolute -right-16 top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-indigo-900/20 blur-2xl" />

            <div className="relative z-[1] text-center lg:text-left">
              <h2 className="text-balance text-[1.35rem] font-bold leading-snug tracking-tight text-white sm:text-[1.5rem] lg:max-w-[18ch] lg:text-[1.6rem]">
                The simplest way to manage your workforce
              </h2>
              <p className="mt-2 text-[0.9rem] text-white/75">Enter your credentials to access your account</p>
            </div>

            <div className="relative z-[1] my-8 flex flex-1 items-center justify-center py-2 lg:my-6">
              <DashboardMockup />
            </div>

            <div className="relative z-[1] mt-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-semibold tracking-wide text-white/55">
              <span>WeChat</span>
              <span>Booking.com</span>
              <span>Google</span>
              <span>Spotify</span>
              <span>stripe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
