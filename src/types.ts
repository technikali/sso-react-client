// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Configuration passed to createSsoAxios / createAuthService.
 *
 * All values are optional and fall back to safe defaults so you can start with
 * just { apiPrefix: '/api/v1' } and override as needed.
 */
export interface SsoConfig {
  /**
   * The API path prefix for your Laravel backend.
   * Default: '/api/v1'
   *
   * Leave VITE_API_BASE_URL empty in production (same-origin nginx proxy).
   * Set it to 'http://127.0.0.1:8000' only for standalone Vite dev.
   */
  apiBaseUrl?: string

  /**
   * Path prefix for your Laravel API routes.
   * Default: '/api/v1'
   */
  apiPrefix?: string

  /**
   * The route the backend serves for the SSO OAuth redirect.
   * Default: '/auth/redirect'
   */
  redirectPath?: string

  /**
   * The web route that returns the JWT when given a one-time ?code= param.
   * Must be at the site root, NOT under the API prefix.
   * Default: '/sso/token'
   */
  tokenPickupPath?: string

  /**
   * The API route that returns the current authenticated user.
   * Default: '/auth/me'
   */
  mePath?: string

  /**
   * The API route to POST for logout (revokes the token server-side).
   * Default: '/auth/logout'
   */
  logoutPath?: string

  /**
   * Where to redirect the browser after login. Passed as ?intended= to the
   * backend, which embeds it in the SSO callback redirect.
   *
   * Typically set to:  window.location.origin + '/login?sso_callback=1'
   *
   * Default: window.location.origin + '/login?sso_callback=1'
   */
  intendedUrl?: string

  /**
   * The URL to redirect to when a 401 response is received.
   * Default: '/login'
   */
  loginPath?: string
}

// ─── User shape returned by /me ───────────────────────────────────────────────

/**
 * Shape of the user object returned by your /me endpoint.
 * Extend or replace this with a generic parameter if your user shape differs.
 */
export interface SsoUser {
  id: string
  name?: string
  email: string
  roles?: string[]
  permissions?: string[]
  [key: string]: unknown
}

// ─── Auth store state ─────────────────────────────────────────────────────────

export interface SsoAuthState<TUser extends SsoUser = SsoUser> {
  /** Null until login completes. Token is NOT persisted — stays in memory. */
  token: string | null
  user: TUser | null
  isAuthenticated: boolean

  login: (token: string, user: TUser) => void
  logout: () => void

  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
}

// ─── Auth service ─────────────────────────────────────────────────────────────

export interface SsoAuthService<TUser extends SsoUser = SsoUser> {
  redirectToSso: (intended?: string) => void
  pickupSsoToken: (code: string) => Promise<string>
  me: () => Promise<TUser>
  logout: () => Promise<{ message?: string; logout_url?: string }>
}

// ─── useSsoLogin options ──────────────────────────────────────────────────────

export interface UseSsoLoginOptions<TUser extends SsoUser = SsoUser> {
  /** Called with the token + user after a successful SSO code exchange. */
  onLogin: (token: string, user: TUser) => void
  /**
   * Where to navigate after login. Called with TanStack Router navigate,
   * React Router navigate, or you can implement as window.location.href.
   */
  onNavigate: (path: string) => void
  /** Destination after login. Default: '/dashboard' */
  dashboardPath?: string
  /** ms between auto-retry attempts on error. Default: 8000 */
  retryThrottleMs?: number
}

// ─── Logout result ────────────────────────────────────────────────────────────

export interface LogoutResult {
  message?: string
  logout_url?: string
}
