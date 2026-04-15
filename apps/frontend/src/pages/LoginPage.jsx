import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** Nextgen-style minimal login; email value is sent as `username` for the existing API. */
export function LoginPage({ error, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    await onLogin({ username: email.trim(), password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#e5e7eb] p-4 font-sans antialiased">
      <div className="w-full max-w-[380px] rounded-xl border border-slate-200/90 bg-white p-7 shadow-[0_4px_24px_rgba(15,23,42,0.08)] sm:p-8">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Login</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-slate-600">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-[9px] border border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm transition hover:border-slate-300 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-end gap-2">
              <label htmlFor="login-password" className="mr-auto text-xs font-medium text-slate-600">
                Password
              </label>
              <button
                type="button"
                className="text-[11px] font-medium text-[#4F46E5] transition hover:text-[#4338CA] hover:underline"
                onClick={(e) => e.preventDefault()}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-[9px] border border-slate-200 bg-white py-2 pl-3 pr-10 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-sm transition hover:border-slate-300 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
              </button>
            </div>
          </div>

          {error ? (
            <p className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-1 h-9 w-full rounded-[9px] bg-[#4F46E5] text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#4338CA] hover:shadow-md active:scale-[0.995]"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  )
}
