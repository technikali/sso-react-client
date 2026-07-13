import axios, { type AxiosInstance } from 'axios'
import type { SsoConfig } from './types.js'

export interface SsoAxiosInstance extends AxiosInstance {
  /** Set the Bearer token on all subsequent requests. Pass null to clear. */
  setAccessToken: (token: string | null) => void
  /** Return the current in-memory token. */
  getAccessToken: () => string | null
}

/**
 * Creates an Axios instance pre-configured for the SSO pattern:
 *  - In-memory Bearer token (not localStorage — XSS-safe)
 *  - 401 interceptor that redirects to the login page
 *  - withCredentials: true (for cookie-based SSO session on the auth server)
 *
 * @example
 * ```ts
 * // src/lib/api.ts
 * import { createSsoAxios } from '@technikali/sso-react'
 *
 * export const api = createSsoAxios({
 *   apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
 *   apiPrefix: '/api/v1',
 *   loginPath: '/login',
 * })
 *
 * export const { setAccessToken, getAccessToken } = api
 * ```
 */
export function createSsoAxios(config: SsoConfig = {}): SsoAxiosInstance {
  const {
    apiBaseUrl = '',
    apiPrefix = '/api/v1',
    loginPath = '/login',
  } = config

  // ── Internal token store (module-level per factory call) ──────────────────
  let _token: string | null = null

  const instance = axios.create({
    baseURL: `${apiBaseUrl}${apiPrefix}`,
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  }) as SsoAxiosInstance

  // ── Token helpers attached to the instance ────────────────────────────────
  instance.setAccessToken = (token: string | null) => {
    _token = token
    if (token) {
      instance.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete instance.defaults.headers.common['Authorization']
    }
  }

  instance.getAccessToken = () => _token

  // ── 401 interceptor ───────────────────────────────────────────────────────
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (
        err.response?.status === 401 &&
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith(loginPath)
      ) {
        instance.setAccessToken(null)
        window.location.href = loginPath
      }
      return Promise.reject(err)
    },
  )

  return instance
}
