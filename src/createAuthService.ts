import type { AxiosInstance } from 'axios'
import type { SsoConfig, SsoAuthService, SsoUser, LogoutResult } from './types.js'

/**
 * Creates an auth service object that wraps the SSO API endpoints.
 *
 * Pass in your axios instance (from createSsoAxios) and the SSO config.
 *
 * @example
 * ```ts
 * // src/services/auth.service.ts
 * import { createAuthService } from '@technikali/sso-react'
 * import { api } from '@/lib/api'
 *
 * export const authService = createAuthService(api, {
 *   redirectPath: '/auth/redirect',
 *   tokenPickupPath: '/sso/token',
 *   mePath: '/auth/me',
 *   logoutPath: '/auth/logout',
 * })
 * ```
 */
export function createAuthService<TUser extends SsoUser = SsoUser>(
  api: AxiosInstance,
  config: SsoConfig = {},
): SsoAuthService<TUser> {
  const {
    apiBaseUrl = '',
    redirectPath = '/auth/redirect',
    tokenPickupPath = '/sso/token',
    mePath = '/auth/me',
    logoutPath = '/auth/logout',
  } = config

  return {
    /**
     * Redirect the browser to the backend's SSO redirect endpoint.
     * The backend will redirect to the SSO server's login page (if no
     * SSO session exists) or straight to the callback (if it does).
     *
     * Prefixed with apiBaseUrl so this still works when the SPA and the
     * Laravel API are on different origins (e.g. separate Valet domains
     * in local/dev, not just the same-origin nginx-proxy production
     * setup) — otherwise the browser is sent to `${redirectPath}` on the
     * SPA's own origin, which has no such route, and the app loops.
     *
     * @param intended - URL to return to after login.
     *   Typically: window.location.origin + '/login?sso_callback=1'
     *   or any route you want the user to land on after auth.
     */
    redirectToSso(intended?: string) {
      const q = intended ? `?intended=${encodeURIComponent(intended)}` : ''
      window.location.href = `${apiBaseUrl}${redirectPath}${q}`
    },

    /**
     * Exchange the one-time `?sso_code=` query param for the JWT.
     *
     * IMPORTANT: the pickup route lives at the site root, not under the
     * API prefix (e.g. `/sso/token`, not `/api/v1/sso/token`).
     * We override baseURL to apiBaseUrl (falling back to same-origin '/')
     * so axios doesn't prepend the API prefix — or hit the wrong origin
     * when the SPA and API are on separate domains.
     */
    pickupSsoToken(code: string): Promise<string> {
      return api
        .get<{ token: string }>(
          `${tokenPickupPath}?code=${encodeURIComponent(code)}`,
          { baseURL: apiBaseUrl || '/' },
        )
        .then((r) => r.data.token)
    },

    /**
     * Fetch the currently authenticated user from the backend.
     * The backend must have a route protected by `sso.verify` middleware
     * that returns `{ user: { ... } }`.
     */
    me(): Promise<TUser> {
      return api.get<{ user: TUser }>(mePath).then((r) => r.data.user)
    },

    /**
     * Revoke the access token server-side and retrieve the SSO logout URL.
     *
     * After calling this, the caller must:
     *   1. Clear local auth state (store.logout())
     *   2. Navigate to result.logout_url to destroy the SSO session —
     *      skipping this step causes immediate re-login on the next redirect.
     */
    logout(): Promise<LogoutResult> {
      return api.post<LogoutResult>(logoutPath).then((r) => r.data)
    },
  }
}
