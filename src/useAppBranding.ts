import { useEffect, useState } from 'react'

export interface AppBranding {
  name: string
  /** Either an uploaded image URL, an emoji/short text mark, or null if unset. */
  icon: string | null
}

/** True for anything renderable as an <img src>; false for emoji/plain text marks. */
export function isImageIcon(icon: string | null | undefined): boolean {
  return !!icon && (icon.startsWith('http') || icon.startsWith('/'))
}

const brandingCache = new Map<string, AppBranding | null>()

/**
 * Fetches {name, icon} for one app from the SSO server's public branding
 * endpoint (`GET {ssoServerUrl}/api/apps/{slug}/branding`) — no auth
 * required, since this has to resolve before the user has signed in.
 *
 * This is what lets an icon edited in core.bansud (which just writes to
 * the App record on auth.bansud) show up in every consuming app's SSO
 * loader without each app maintaining its own copy of the logo. Falls back
 * to `null` (caller should render its own static default) on any failure —
 * a branding fetch glitch should never block sign-in.
 *
 * @param ssoServerUrl e.g. import.meta.env.VITE_SSO_SERVER_URL
 * @param slug this app's own slug as registered in core.bansud, e.g. 'admin'
 */
export function useAppBranding(ssoServerUrl: string | undefined, slug: string | undefined): {
  branding: AppBranding | null
  loading: boolean
} {
  const cacheKey = ssoServerUrl && slug ? `${ssoServerUrl}::${slug}` : null
  const [branding, setBranding] = useState<AppBranding | null>(
    cacheKey ? brandingCache.get(cacheKey) ?? null : null
  )
  const [loading, setLoading] = useState(!!cacheKey && !brandingCache.has(cacheKey))

  useEffect(() => {
    if (!ssoServerUrl || !slug) {
      setLoading(false)
      return
    }

    const key = `${ssoServerUrl}::${slug}`
    if (brandingCache.has(key)) {
      setBranding(brandingCache.get(key) ?? null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`${ssoServerUrl.replace(/\/$/, '')}/api/apps/${encodeURIComponent(slug)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AppBranding | null) => {
        if (cancelled) return
        brandingCache.set(key, data)
        setBranding(data)
      })
      .catch(() => {
        if (cancelled) return
        brandingCache.set(key, null)
        setBranding(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ssoServerUrl, slug])

  return { branding, loading }
}
