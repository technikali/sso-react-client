import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { SsoUser, SsoAuthService } from './types.js'
import type { SsoAxiosInstance } from './createSsoAxios.js'

// ─── Context shape ────────────────────────────────────────────────────────────

export interface SsoContextValue<TUser extends SsoUser = SsoUser> {
  user: TUser | null
  isAuthenticated: boolean
  isLoading: boolean
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
  login: (token: string, user: TUser) => void
  logout: () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SsoContext = createContext<SsoContextValue<any> | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface SsoProviderProps<TUser extends SsoUser = SsoUser> {
  children: ReactNode
  authService: SsoAuthService<TUser>
  api: SsoAxiosInstance
  /**
   * If true, the provider calls /me on mount to rehydrate the user.
   * Useful when the token is already set (e.g. from persisted storage).
   * Default: false
   */
  loadOnMount?: boolean
  /**
   * Re-fetch the user when the tab regains focus (detects cross-app logout).
   * Default: true
   */
  revalidateOnFocus?: boolean
  /**
   * URL to redirect to after logout destroys the SSO session.
   * If the logout API returns a logout_url, that takes precedence.
   * Default: '/login'
   */
  loginPath?: string
}

/**
 * Context-based alternative to the Zustand store.
 *
 * Wrap your app (or the authenticated subtree) with <SsoProvider> and access
 * auth state via `useSso()`.
 *
 * @example
 * ```tsx
 * // src/main.tsx
 * import { SsoProvider } from '@technikali/sso-react'
 * import { authService } from '@/services/auth.service'
 * import { api } from '@/lib/api'
 *
 * root.render(
 *   <SsoProvider authService={authService} api={api} revalidateOnFocus>
 *     <App />
 *   </SsoProvider>
 * )
 * ```
 */
export function SsoProvider<TUser extends SsoUser = SsoUser>({
  children,
  authService,
  api,
  loadOnMount = false,
  revalidateOnFocus = true,
  loginPath = '/login',
}: SsoProviderProps<TUser>) {
  const [user, setUser] = useState<TUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(loadOnMount)

  const loadUser = useCallback(async () => {
    if (!api.getAccessToken()) return
    try {
      const u = await authService.me()
      setUser(u)
      setIsAuthenticated(true)
    } catch {
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [api, authService])

  // Initial load (if token already set from persisted store)
  useEffect(() => {
    if (!loadOnMount) return
    setIsLoading(true)
    loadUser().finally(() => setIsLoading(false))
  }, [loadOnMount, loadUser])

  // Re-validate on tab focus to detect cross-app SSO logout
  useEffect(() => {
    if (!revalidateOnFocus) return

    const revalidate = () => {
      if (document.visibilityState === 'visible') loadUser()
    }

    document.addEventListener('visibilitychange', revalidate)
    window.addEventListener('focus', revalidate)

    return () => {
      document.removeEventListener('visibilitychange', revalidate)
      window.removeEventListener('focus', revalidate)
    }
  }, [revalidateOnFocus, loadUser])

  const login = useCallback((token: string, u: TUser) => {
    api.setAccessToken(token)
    setUser(u)
    setIsAuthenticated(true)
  }, [api])

  const logout = useCallback(async () => {
    let logoutUrl: string | undefined
    try {
      const res = await authService.logout()
      logoutUrl = res.logout_url
    } catch { /* ignore */ }

    api.setAccessToken(null)
    setUser(null)
    setIsAuthenticated(false)

    // Destroy the SSO session on the auth server — critical to prevent
    // immediate re-login on the next /auth/redirect call.
    window.location.href = logoutUrl ?? loginPath
  }, [api, authService, loginPath])

  const hasRole = useCallback(
    (role: string) => user?.roles?.includes(role) ?? false,
    [user],
  )

  const hasPermission = useCallback(
    (permission: string) => user?.permissions?.includes(permission) ?? false,
    [user],
  )

  const value: SsoContextValue<TUser> = {
    user,
    isAuthenticated,
    isLoading,
    hasRole,
    hasPermission,
    login,
    logout,
  }

  return <SsoContext.Provider value={value}>{children}</SsoContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access SSO auth state from any component inside <SsoProvider>.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, logout, hasRole } = useSso()
 * ```
 */
export function useSso<TUser extends SsoUser = SsoUser>(): SsoContextValue<TUser> {
  const ctx = useContext(SsoContext)
  if (!ctx) {
    throw new Error('useSso() must be used inside <SsoProvider>.')
  }
  return ctx as SsoContextValue<TUser>
}
