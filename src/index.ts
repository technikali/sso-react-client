// ─── Core factories ───────────────────────────────────────────────────────────
export { createSsoAxios } from './createSsoAxios.js'
export type { SsoAxiosInstance } from './createSsoAxios.js'

export { createAuthService } from './createAuthService.js'

export { createAuthStore } from './createAuthStore.js'
export type { CreateAuthStoreOptions } from './createAuthStore.js'

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useSsoLogin } from './useSsoLogin.js'
export type { UseSsoLoginProps } from './useSsoLogin.js'

export { useLogout } from './useLogout.js'
export type { UseLogoutOptions } from './useLogout.js'

// ─── Context (alternative to Zustand store) ───────────────────────────────────
export { SsoProvider, useSso } from './SsoProvider.js'
export type { SsoProviderProps, SsoContextValue } from './SsoProvider.js'

// ─── UI ───────────────────────────────────────────────────────────────────────
export { SsoLoader } from './SsoLoader.js'
export type { SsoLoaderProps } from './SsoLoader.js'

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SsoConfig,
  SsoUser,
  SsoAuthState,
  SsoAuthService,
  UseSsoLoginOptions,
  LogoutResult,
} from './types.js'
