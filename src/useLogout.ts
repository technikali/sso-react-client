import type { SsoAuthService, SsoUser } from './types.js'
import type { SsoAxiosInstance } from './createSsoAxios.js'

export interface UseLogoutOptions<TUser extends SsoUser = SsoUser> {
  authService: SsoAuthService<TUser>
  api: SsoAxiosInstance
  /** Called to clear local auth state (store.logout(), context setState, etc.) */
  onClear: () => void
  /** URL if the backend doesn't return a logout_url. Default: '/login' */
  loginPath?: string
}

/**
 * Returns a `handleLogout` function that performs the three-step SSO logout:
 *   1. POST /auth/logout — revoke the token server-side (returns a logout_url)
 *   2. Clear local state (token + store/context)
 *   3. Navigate to the SSO server's logout endpoint to destroy the session
 *
 * Skipping step 3 causes immediate re-login on the next redirect.
 *
 * @example
 * ```tsx
 * import { useLogout } from '@technikali/sso-react'
 * import { authService } from '@/services/auth.service'
 * import { api } from '@/lib/api'
 * import { useAuthStore } from '@/stores/auth.store'
 *
 * function NavBar() {
 *   const storeLogout = useAuthStore((s) => s.logout)
 *   const handleLogout = useLogout({
 *     authService,
 *     api,
 *     onClear: storeLogout,
 *   })
 *   return <button onClick={handleLogout}>Sign out</button>
 * }
 * ```
 */
export function useLogout<TUser extends SsoUser = SsoUser>({
  authService,
  api,
  onClear,
  loginPath = '/login',
}: UseLogoutOptions<TUser>) {
  return async function handleLogout() {
    let logoutUrl: string | undefined

    try {
      const res = await authService.logout()
      logoutUrl = res.logout_url
    } catch {
      // Ignore errors — we still clear state and end the session
    }

    // Clear the in-memory token
    api.setAccessToken(null)
    // Clear store / context
    onClear()

    // Destroy the SSO session on the auth server.
    // Without this, the next /auth/redirect auto-logs the same user back in.
    window.location.href = logoutUrl ?? loginPath
  }
}
