import { useEffect, useRef } from 'react'
import type { SsoAuthService, SsoUser, UseSsoLoginOptions } from './types.js'
import type { SsoAxiosInstance } from './createSsoAxios.js'

/**
 * Hook that implements the seamless SSO login flow (Pattern C).
 *
 * Mount this on your login page (or any route that needs SSO handling).
 * It handles three scenarios automatically:
 *
 *   1. **Callback** — URL has `?sso_callback=1&sso_code=<code>`:
 *      Exchange the code for a JWT, load the user, call onLogin, navigate to dashboard.
 *
 *   2. **Unauthenticated, no callback** — automatically redirect to the SSO server.
 *      If the SSO session exists (user already logged in elsewhere), they go
 *      straight to the dashboard with no login form shown.
 *
 *   3. **Error / retry** — on failure, throttle and retry the redirect so a
 *      transient error becomes a slow retry, not an infinite storm.
 *
 * @example
 * ```tsx
 * // src/routes/login.tsx
 * import { useSsoLogin } from '@technikali/sso-react'
 * import { authService } from '@/services/auth.service'
 * import { api } from '@/lib/api'
 * import { useAuthStore } from '@/stores/auth.store'
 * import { useNavigate } from '@tanstack/react-router'
 *
 * export function LoginPage() {
 *   const navigate = useNavigate()
 *   const { login } = useAuthStore()
 *
 *   useSsoLogin({
 *     authService,
 *     api,
 *     onLogin: (token, user) => login(token, user),
 *     onNavigate: (path) => navigate({ to: path }),
 *     dashboardPath: '/dashboard',
 *   })
 *
 *   return <p>Signing you in…</p>
 * }
 * ```
 */

export interface UseSsoLoginProps<TUser extends SsoUser = SsoUser>
  extends UseSsoLoginOptions<TUser> {
  authService: SsoAuthService<TUser>
  /** The axios instance — used to set the Bearer token before loading the user. */
  api: SsoAxiosInstance
  /**
   * The URL the SSO callback redirects back to. Must include the
   * `?sso_callback=1` marker so this hook can detect the return.
   *
   * Default: window.location.origin + '/login?sso_callback=1'
   */
  callbackUrl?: string
}

/** Module-level guard: prevents React 18 StrictMode from consuming the
 *  one-time SSO code twice (the code is deleted from the cache on first use). */
let _consumedSsoCode: string | null = null

export function useSsoLogin<TUser extends SsoUser = SsoUser>({
  authService,
  api,
  onLogin,
  onNavigate,
  dashboardPath = '/dashboard',
  retryThrottleMs = 8000,
  callbackUrl,
}: UseSsoLoginProps<TUser>) {
  const busyRef = useRef(false)

  useEffect(() => {
    if (busyRef.current) return
    busyRef.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('sso_code')
    const hasCallback = params.has('sso_callback')
    const hasError =
      params.has('error') || params.has('error_description')

    // ── 1. Completing an SSO callback ─────────────────────────────────────
    if (hasCallback && code) {
      if (_consumedSsoCode === code) {
        busyRef.current = false
        return
      }
      _consumedSsoCode = code

      authService
        .pickupSsoToken(code)
        .then(async (token) => {
          api.setAccessToken(token)
          const user = await authService.me()
          onLogin(token, user)
          onNavigate(dashboardPath)
        })
        .catch(() => {
          busyRef.current = false
          doAutoSignIn(true)
        })
      return
    }

    // ── 2. Not a callback — auto-start SSO (with retry throttle on error) ──
    doAutoSignIn(hasError)

    function doAutoSignIn(isRetry: boolean) {
      const intended =
        callbackUrl ??
        `${window.location.origin}${window.location.pathname}?sso_callback=1`

      const go = () => {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('sso_last_attempt', String(Date.now()))
        }
        authService.redirectToSso(intended)
      }

      if (!isRetry) {
        go()
        return
      }

      // Throttle: wait out the remainder of retryThrottleMs since last attempt.
      const last =
        typeof sessionStorage !== 'undefined'
          ? Number(sessionStorage.getItem('sso_last_attempt') || 0)
          : 0
      const wait = Math.max(0, retryThrottleMs - (Date.now() - last))
      window.setTimeout(go, wait)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
