import { useState } from 'react'
import { Activity, Eye, EyeOff, LayoutDashboard, Sparkles } from 'lucide-react'

/**
 * Optional alternate login layout (not used by default App shell).
 * Tailwind CSS + lucide-react. No external images.
 */
export function CenAnalyticsLandingLogin({
  onLogin,
  onRequestDemo,
  onGetStarted,
  onForgotPassword,
  onCreateAccount,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    onLogin?.({ email, password, remember })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#0F172A] antialiased">
      <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_20px_50px_-12px_rgba(15,23,42,0.12)]">
          <div className="grid lg:grid-cols-2">
            {/* Left — brand & intro */}
            <div className="flex flex-col justify-between gap-10 border-b border-[#E2E8F0] bg-gradient-to-br from-[#F8FAFC] via-white to-[#EEF2FF]/60 px-8 py-10 sm:px-10 sm:py-12 lg:border-b-0 lg:border-r lg:border-[#E2E8F0]">
              <div className="space-y-8">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-[#4F46E5]">
                    Console
                  </p>
                  <h1 className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight text-[#0F172A] sm:text-4xl">
                    Turn Data Into Clear Decisions
                  </h1>
                  <p className="mt-4 max-w-lg text-base leading-relaxed text-[#64748B]">
                    Sign in to continue.
                  </p>
                </div>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]">
                      <LayoutDashboard className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="font-medium text-[#0F172A]">Centralized reporting</p>
                      <p className="text-sm text-[#64748B]">One hub for metrics your team trusts.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]">
                      <Activity className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="font-medium text-[#0F172A]">Real-time insights</p>
                      <p className="text-sm text-[#64748B]">See changes as they happen, not next week.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5]/10 text-[#4F46E5]">
                      <Sparkles className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="font-medium text-[#0F172A]">Smarter decisions</p>
                      <p className="text-sm text-[#64748B]">Clarity that shortens time to action.</p>
                    </div>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={onRequestDemo}
                  className="w-fit rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-medium text-[#0F172A] shadow-sm transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 focus:ring-offset-2"
                >
                  Request Demo
                </button>
              </div>

              {/* Mini KPI preview */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[14px] border border-[#E2E8F0] bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-medium text-[#64748B]">Reports Generated</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-[#0F172A]">12.4K</p>
                </div>
                <div className="rounded-[14px] border border-[#E2E8F0] bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-medium text-[#64748B]">Data Sources</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-[#0F172A]">18</p>
                </div>
                <div className="rounded-[14px] border border-[#E2E8F0] bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-medium text-[#64748B]">Decision Time</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-[#4F46E5]">−42%</p>
                </div>
              </div>
            </div>

            {/* Right — login */}
            <div className="flex flex-col justify-center bg-[#F8FAFC]/50 px-8 py-10 sm:px-10 sm:py-12">
              <div className="mx-auto w-full max-w-md rounded-[18px] border border-[#E2E8F0] bg-white p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] sm:p-9">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
                    Welcome back
                  </h2>
                  <p className="mt-2 text-sm text-[#64748B]">
                    Sign in to access your analytics workspace
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="cen-email" className="mb-1.5 block text-sm font-medium text-[#0F172A]">
                      Email address
                    </label>
                    <input
                      id="cen-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-[14px] border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
                      required
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="cen-password" className="text-sm font-medium text-[#0F172A]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-sm font-medium text-[#4F46E5] transition hover:text-[#4338CA]"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="cen-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-[14px] border border-[#E2E8F0] bg-white py-3 pl-4 pr-12 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
                        required
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="cen-remember"
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-[#CBD5E1] text-[#4F46E5] focus:ring-[#4F46E5]/30"
                    />
                    <label htmlFor="cen-remember" className="text-sm text-[#64748B]">
                      Remember me
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 pt-1">
                    <button
                      type="submit"
                      className="w-full rounded-[14px] bg-[#4F46E5] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338CA] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-2"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={onGetStarted}
                      className="w-full rounded-[14px] border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#0F172A] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
                    >
                      Get Started
                    </button>
                  </div>
                </form>

                <p className="mt-8 text-center text-sm text-[#64748B]">
                  New account?{' '}
                  <button
                    type="button"
                    onClick={onCreateAccount}
                    className="font-medium text-[#4F46E5] transition hover:text-[#4338CA]"
                  >
                    Create an account
                  </button>
                </p>
              </div>

              <p className="mx-auto mt-6 max-w-md text-center text-xs text-[#94A3B8]">
                Protected by industry-standard encryption. By signing in you agree to our terms and
                privacy policy.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[#94A3B8]">
          © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

export default CenAnalyticsLandingLogin
