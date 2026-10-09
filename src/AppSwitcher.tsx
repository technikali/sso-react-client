import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { isImageIcon } from './useAppBranding.js'
import { deriveHostPalette, paletteVars, type SwitcherPalette } from './hostTheme.js'

/**
 * The header "App Center" button shared by every Bansud app: a mega menu of
 * the apps and services tagged to the signed-in account in auth.bansud
 * (`GET {ssoServerUrl}/api/user/apps`, called with the user's own SSO token —
 * auth decides what the person may see), plus a link back to the App Center.
 *
 * Icons are the ones managed in core.bansud (App.icon), rendered with the same
 * rule core uses: an image URL → the image; any other text → that mark (emoji);
 * nothing → initials.
 *
 * Self-contained (scoped `bsw-` classes, injected once) but themed by its
 * host: when it opens it reads the surrounding header's surface and text
 * colours, the app's primary colour, corner radius and font (see hostTheme),
 * so it complements whichever app it sits in — light or dark. `palette`
 * overrides any of those (e.g. from an MUI theme).
 */

export interface SwitcherApp {
  name: string
  slug: string
  url: string
  icon: string | null
  description?: string | null
  kind?: 'app' | 'service' | string | null
  role?: string | null
}

export interface AppSwitcherProps {
  /** auth.bansud origin, e.g. import.meta.env.VITE_SSO_SERVER_URL */
  ssoServerUrl?: string
  /** Returns the current SSO access token (sent as Bearer to auth.bansud). */
  getAccessToken?: () => string | null | undefined
  /** App Center (app.bansud) URL — always linked at the bottom of the menu. */
  appCenterUrl: string
  /** Optional custom loader (e.g. through the app's own backend). */
  fetchApps?: () => Promise<SwitcherApp[]>
  /** Hint used only when the host's colours can't be read: 'auto' follows the page's dark-mode marker. */
  theme?: 'auto' | 'light' | 'dark'
  /** Explicit colours/radius/font, overriding what is read from the host app. */
  palette?: Partial<SwitcherPalette>
  /** Classes/styles for the trigger button so it matches the host header. */
  triggerClassName?: string
  triggerStyle?: CSSProperties
  iconSize?: number
  /** Accessible label / tooltip of the trigger. */
  label?: string
}

const CACHE_MS = 5 * 60_000
let cache: { key: string; at: number; apps: SwitcherApp[] } | null = null

async function loadFromAuth(ssoServerUrl: string, token: string | null | undefined): Promise<SwitcherApp[]> {
  const res = await fetch(`${ssoServerUrl.replace(/\/$/, '')}/api/user/apps`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error(`auth.bansud returned ${res.status}`)
  const body = (await res.json()) as { apps?: Array<SwitcherApp & { pivot?: { role?: string | null } }> }
  return (body.apps ?? []).map((a) => ({ ...a, role: a.role ?? a.pivot?.role ?? null }))
}

function cleanApps(apps: SwitcherApp[]): SwitcherApp[] {
  return apps.filter((a) => a && a.name && /^https?:\/\//i.test(a.url))
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const TILE_COLORS = ['#1e40af', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#047857', '#0369a1', '#a16207']
function tileColor(key: string) {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TILE_COLORS[h % TILE_COLORS.length]
}

function isCurrent(app: SwitcherApp) {
  try {
    return typeof window !== 'undefined' && new URL(app.url).origin === window.location.origin
  } catch {
    return false
  }
}

function pageIsDark(): boolean {
  if (typeof document === 'undefined') return false
  const html = document.documentElement
  const body = document.body
  return html.classList.contains('dark') || body?.classList.contains('dark')
    || html.getAttribute('data-theme') === 'dark' || body?.getAttribute('data-theme') === 'dark'
    || html.getAttribute('data-mui-color-scheme') === 'dark' || html.getAttribute('data-color-scheme') === 'dark'
    || html.style.colorScheme === 'dark'
}

const STYLE_ID = 'bansud-app-switcher-styles'
const CSS = `
.bsw-trigger{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit;cursor:pointer;border-radius:9999px;padding:0}
.bsw-trigger:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}
.bsw-panel{--bsw-bg:#ffffff;--bsw-fg:#111827;--bsw-muted:#6b7280;--bsw-border:#e5e7eb;--bsw-hover:#f3f4f6;--bsw-accent:#1d4ed8;--bsw-accent-bg:rgba(29,78,216,.08);
  position:fixed;z-index:2147483000;display:flex;flex-direction:column;background:var(--bsw-bg);color:var(--bsw-fg);border:1px solid var(--bsw-border);
  border-radius:calc(var(--bsw-radius,12px) * 1.25);box-shadow:var(--bsw-shadow,0 18px 50px -12px rgba(0,0,0,.35));font-size:14px;line-height:1.4;font-family:var(--bsw-font,system-ui,sans-serif);overflow:hidden;
  animation:bsw-in .12s ease-out}
@keyframes bsw-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.bsw-head{display:flex;align-items:center;gap:8px;padding:14px 16px 8px}
.bsw-title{flex:1;font-weight:700;font-size:15px}
.bsw-search{height:32px;width:170px;border:1px solid var(--bsw-border);border-radius:var(--bsw-radius,8px);background:transparent;color:inherit;padding:0 10px;font:inherit;font-size:13px;outline:none}
.bsw-search:focus{border-color:var(--bsw-accent)}
.bsw-body{flex:1;overflow-y:auto;padding:0 12px 8px}
.bsw-group{margin-bottom:8px}
.bsw-group-title{padding:4px 4px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--bsw-muted)}
.bsw-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
@media (max-width:480px){.bsw-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.bsw-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:var(--bsw-radius,12px);border:1px solid transparent;text-decoration:none;color:inherit;text-align:center;min-width:0}
.bsw-tile:hover,.bsw-tile:focus-visible{background:var(--bsw-hover);outline:none}
.bsw-tile[aria-current=page]{border-color:var(--bsw-accent);background:var(--bsw-accent-bg)}
.bsw-logo{width:44px;height:44px;border-radius:calc(var(--bsw-radius,12px) * .85);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.bsw-logo img{width:100%;height:100%;object-fit:cover}
.bsw-logo.bsw-emoji{font-size:24px;background:var(--bsw-hover)}
.bsw-logo.bsw-initials{color:#fff;font-weight:800;font-size:15px}
.bsw-name{font-size:13px;font-weight:600;line-height:1.2;overflow-wrap:anywhere}
.bsw-sub{font-size:11px;line-height:1.2;color:var(--bsw-muted);min-height:13px}
.bsw-tile[aria-current=page] .bsw-sub{color:var(--bsw-accent-text,var(--bsw-accent));font-weight:600}
.bsw-msg{padding:20px 12px;text-align:center;color:var(--bsw-muted);font-size:13px}
.bsw-foot{border-top:1px solid var(--bsw-border);padding:6px}
.bsw-center{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-radius:var(--bsw-radius,8px);color:var(--bsw-accent-text,var(--bsw-accent));font-weight:600;text-decoration:none}
.bsw-center:hover,.bsw-center:focus-visible{background:var(--bsw-hover);outline:none}
.bsw-spin{width:20px;height:20px;border:2px solid var(--bsw-border);border-top-color:var(--bsw-accent);border-radius:50%;margin:24px auto;animation:bsw-rot .8s linear infinite}
@keyframes bsw-rot{to{transform:rotate(360deg)}}
`

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

function GridIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

/** core.bansud's AppLogo rule: image URL → image; other text → emoji mark; none (or a broken image) → initials. */
function AppLogo({ app }: { app: SwitcherApp }) {
  const [broken, setBroken] = useState(false)
  if (isImageIcon(app.icon) && !broken) {
    return <span className="bsw-logo"><img src={app.icon!} alt="" loading="lazy" onError={() => setBroken(true)} /></span>
  }
  if (app.icon && !isImageIcon(app.icon)) {
    return <span className="bsw-logo bsw-emoji" aria-hidden="true">{app.icon}</span>
  }
  return <span className="bsw-logo bsw-initials" style={{ background: tileColor(app.slug || app.name) }} aria-hidden="true">{initials(app.name)}</span>
}

function Group({ title, apps, onPick }: { title: string; apps: SwitcherApp[]; onPick: () => void }) {
  if (!apps.length) return null
  return (
    <div className="bsw-group">
      <div className="bsw-group-title">{title}</div>
      <div className="bsw-grid">
        {apps.map((app) => {
          const current = isCurrent(app)
          return (
            <a key={app.slug || app.url} className="bsw-tile" href={app.url} aria-current={current ? 'page' : undefined} onClick={onPick}
              title={app.description ?? app.name}>
              <AppLogo app={app} />
              <span className="bsw-name">{app.name}</span>
              <span className="bsw-sub">{current ? "You're here" : app.role ?? ' '}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

export function AppSwitcher({
  ssoServerUrl, getAccessToken, appCenterUrl, fetchApps, theme = 'auto', palette,
  triggerClassName, triggerStyle, iconSize = 18, label = 'Apps',
}: AppSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [apps, setApps] = useState<SwitcherApp[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [hostPalette, setHostPalette] = useState<SwitcherPalette | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(ensureStyles, [])

  // An app without SSO (no auth.bansud origin or loader) can't know the
  // account's apps; it still offers the App Center.
  const linked = !!fetchApps || !!ssoServerUrl

  const load = useCallback(async () => {
    if (!linked) {
      setApps([])
      return
    }
    // Cached per auth server AND per signed-in token, so a different person
    // signing in on the same tab never sees the previous person's apps. A
    // custom loader (the app's own backend) does its own caching.
    const token = getAccessToken?.() ?? ''
    const key = `${ssoServerUrl ?? ''}::${token}`
    if (!fetchApps && cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
      setApps(cache.apps)
      return
    }
    setFailed(false)
    try {
      const list = cleanApps(fetchApps ? await fetchApps() : await loadFromAuth(ssoServerUrl ?? '', token))
      if (!fetchApps) cache = { key, at: Date.now(), apps: list }
      setApps(list)
    } catch {
      setFailed(true)
      setApps([])
    }
  }, [linked, ssoServerUrl, getAccessToken, fetchApps])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.min(460, vw - 32)
    const left = Math.max(16, Math.min(r.right - width, vw - 16 - width))
    const top = r.bottom + 8
    setPos({ top, left, width, maxHeight: Math.max(240, Math.min(560, window.innerHeight - top - 16)) })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    if (triggerRef.current) {
      const fallbackDark = theme === 'dark' || (theme === 'auto' && pageIsDark())
      setHostPalette(deriveHostPalette(triggerRef.current, fallbackDark, palette))
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place, theme, palette])

  useEffect(() => {
    if (!open) return
    void load()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, load])

  useEffect(() => {
    if (open) requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('input, a')?.focus())
    else setSearch('')
  }, [open, apps])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = apps ?? []
    return q ? list.filter((a) => `${a.name} ${a.description ?? ''}`.toLowerCase().includes(q)) : list
  }, [apps, search])

  const close = () => setOpen(false)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`bsw-trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
        style={triggerStyle}
        title={label}
        aria-label={`${label} — apps and services`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <GridIcon size={iconSize} />
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Your apps"
          className="bsw-panel"
          style={{ ...(hostPalette ? paletteVars(hostPalette) : {}), top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } as CSSProperties}
        >
          <div className="bsw-head">
            <div className="bsw-title">Your apps</div>
            {(apps?.length ?? 0) > 8 && (
              <input className="bsw-search" placeholder="Find an app" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find an app" />
            )}
          </div>
          <div className="bsw-body">
            {apps === null && <div className="bsw-spin" role="status" aria-label="Loading apps" />}
            {failed && <div className="bsw-msg">Your apps could not be loaded right now. Use the App Center below.</div>}
            {!linked && <div className="bsw-msg">This app isn't connected to your Bansud account yet. Open the App Center to reach your other apps.</div>}
            {linked && apps !== null && !failed && filtered.length === 0 && (
              <div className="bsw-msg">{search ? 'No app matches.' : 'No apps are tagged to your account yet.'}</div>
            )}
            <Group title="Apps" apps={filtered.filter((a) => a.kind !== 'service')} onPick={close} />
            <Group title="Services" apps={filtered.filter((a) => a.kind === 'service')} onPick={close} />
          </div>
          <div className="bsw-foot">
            <a className="bsw-center" href={appCenterUrl} onClick={close}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><GridIcon size={16} /> Open App Center</span>
              <ExternalIcon />
            </a>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
