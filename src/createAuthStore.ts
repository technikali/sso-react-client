import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
import type { SsoUser, SsoAuthState } from './types.js'

export interface CreateAuthStoreOptions {
  /**
   * Key used by zustand/persist for localStorage.
   * Default: 'sso-auth'
   */
  storageKey?: string

  /**
   * Optional callback fired when logout() is called on the store —
   * useful for disconnecting WebSockets, clearing caches, etc.
   */
  onLogout?: () => void
}

/**
 * Creates a Zustand auth store following the Bansud SSO security pattern:
 *   - Token is NOT persisted (stays in memory only, XSS-safe)
 *   - `user` and `isAuthenticated` are persisted so the UI survives a reload
 *   - On reload with isAuthenticated=true but no token, the app should silently
 *     re-run the SSO flow (see useSsoLogin Pattern C — the SSO session cookie
 *     handles this transparently without showing a login form)
 *
 * @example
 * ```ts
 * // src/stores/auth.store.ts
 * import { createAuthStore } from '@technikali/sso-react'
 * import type { MyUser } from '@/types'
 *
 * export const useAuthStore = createAuthStore<MyUser>({ storageKey: 'myapp-auth' })
 * ```
 */
export function createAuthStore<TUser extends SsoUser = SsoUser>(
  options: CreateAuthStoreOptions = {},
) {
  const { storageKey = 'sso-auth', onLogout } = options

  return create<SsoAuthState<TUser>>()(
    persist(
      (set, get) => ({
        token: null,
        user: null,
        isAuthenticated: false,

        login(token: string, user: TUser) {
          set({ token, user, isAuthenticated: true })
        },

        logout() {
          onLogout?.()
          set({ token: null, user: null, isAuthenticated: false })
        },

        hasRole(role: string) {
          return get().user?.roles?.includes(role) ?? false
        },

        hasPermission(permission: string) {
          return get().user?.permissions?.includes(permission) ?? false
        },
      }),
      {
        name: storageKey,
        /**
         * Only persist the user identity fields.
         * The token is deliberately excluded — it must stay in memory.
         * See: auth.bansud CLAUDE.md → Security Checklist.
         */
        partialize: (state) =>
          ({
            user: state.user,
            isAuthenticated: state.isAuthenticated,
          }) as StorageValue<SsoAuthState<TUser>>['state'],
      },
    ),
  )
}
