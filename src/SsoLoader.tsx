import type { CSSProperties } from 'react'
import { isImageIcon, useAppBranding } from './useAppBranding.js'

/**
 * SsoLoader — the single, shared "signing you in…" screen shown while an app
 * is bouncing through the OAuth authorize round-trip with auth.bansud.gov.ph.
 *
 * Every LGU app (admin, office, HRIS, CRMS, helpdesk, barangay portals) shows
 * the same loader.png mark with a shine sweep instead of each maintaining its
 * own bespoke spinner/markup. Import it from @technikali/sso-react wherever a
 * login route needs to render the in-flight SSO state.
 *
 * Styling is plain inline styles (plus a scoped <style> block for keyframes)
 * rather than Tailwind utility classNames — this package is consumed by both
 * Tailwind apps and MUI-only apps (e.g. my.bansud has no Tailwind pipeline at
 * all), and utility classNames silently do nothing where Tailwind isn't
 * configured. Previously this meant `h-14 w-14`/`fixed inset-0` etc. were
 * inert there, so the <img> fell back to its native pixel size with no
 * positioning constraint — which is what made the loader balloon up and
 * cover the whole page instead of rendering as a small centered mark. Inline
 * styles always apply regardless of the host app's CSS tooling.
 *
 * Each app must have public/images/loader.png (same file, copied per app —
 * there's no cross-app static asset server, so the image ships with every
 * app's own public/ folder) as the fallback mark.
 *
 * Pass `ssoServerUrl` + `appSlug` to have the mark stay in sync with the app
 * icon set in core.bansud instead of the static local file — that's edited
 * on the auth.bansud App registry and fetched here via the public branding
 * endpoint. Falls back to `imageSrc` if no icon is set there, the app isn't
 * registered, or the fetch fails for any reason (never blocks sign-in).
 */
export interface SsoLoaderProps {
  /** Status text under the mark. Default: 'Signing you in…' */
  label?: string
  /** Path to the fallback loader image. Default: '/images/loader.png' */
  imageSrc?: string
  /** Render full-screen (fixed to the viewport, centered) or inline. Default: true */
  fullScreen?: boolean
  /** SSO server origin, e.g. import.meta.env.VITE_SSO_SERVER_URL. Omit to always use imageSrc. */
  ssoServerUrl?: string
  /** This app's own slug as registered in core.bansud, e.g. 'admin'. Omit to always use imageSrc. */
  appSlug?: string
  /** Backdrop color behind the mark. Default: '#ffffff' (does not depend on any host CSS variable). */
  backgroundColor?: string
  /** Label text color. Default: '#6b7280' (a neutral gray, does not depend on any host CSS variable). */
  textColor?: string
}

export function SsoLoader({
  label = 'Signing you in…',
  imageSrc = '/images/loader.png',
  fullScreen = true,
  ssoServerUrl,
  appSlug,
  backgroundColor = '#ffffff',
  textColor = '#6b7280',
}: SsoLoaderProps) {
  const { branding } = useAppBranding(ssoServerUrl, appSlug)
  const dynamicIcon = branding?.icon ?? null
  const useDynamicImage = isImageIcon(dynamicIcon)
  const useDynamicEmoji = !!dynamicIcon && !useDynamicImage

  const wrapperStyle: CSSProperties = fullScreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
      }
    : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }

  return (
    <div style={wrapperStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        {/* Ring sits in its own layer around the mark rather than on the same
            overflow-hidden circle as the logo — the ring's stroke needs to
            extend past the mark's edge, which overflow-hidden would clip. */}
        <div style={{ position: 'relative', display: 'flex', height: 80, width: 80, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg
            className="sso-loader-ring"
            style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
            viewBox="0 0 80 80"
            aria-hidden="true"
          >
            <circle className="sso-loader-ring-track" cx="40" cy="40" r="36" fill="none" strokeWidth="3" />
            <circle className="sso-loader-ring-progress" cx="40" cy="40" r="36" fill="none" strokeWidth="3" />
          </svg>
          <div
            style={{
              position: 'relative', display: 'flex', height: 56, width: 56, alignItems: 'center',
              justifyContent: 'center', overflow: 'hidden', borderRadius: '50%', flexShrink: 0,
            }}
          >
            {useDynamicEmoji ? (
              <span style={{ position: 'relative', zIndex: 10, display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 24, lineHeight: 1 }}>
                {dynamicIcon}
              </span>
            ) : (
              <img
                src={useDynamicImage ? (dynamicIcon as string) : imageSrc}
                alt=""
                style={{ position: 'relative', zIndex: 10, height: '100%', width: '100%', objectFit: 'contain' }}
              />
            )}
            <span className="sso-loader-shine" aria-hidden="true" />
          </div>
        </div>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: textColor, margin: 0 }}>
          {label}
        </p>
      </div>

      <style>{`
        .sso-loader-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            115deg,
            transparent 20%,
            rgba(255, 255, 255, 0.75) 50%,
            transparent 80%
          );
          transform: translateX(-100%);
          animation: sso-loader-shine-sweep 1.8s ease-in-out infinite;
        }
        @keyframes sso-loader-shine-sweep {
          0%   { transform: translateX(-100%); }
          55%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        .sso-loader-ring {
          transform: rotate(-90deg);
        }
        .sso-loader-ring-track {
          stroke: currentColor;
          opacity: 0.15;
          color: ${textColor};
        }
        .sso-loader-ring-progress {
          stroke: currentColor;
          stroke-linecap: round;
          transform-origin: 40px 40px;
          color: ${textColor};
          /* circumference = 2 * PI * r(36) ≈ 226.19 */
          stroke-dasharray: 226.19;
          animation: sso-loader-ring-progress 1.6s ease-in-out infinite;
        }
        @keyframes sso-loader-ring-progress {
          0%   { stroke-dashoffset: 226.19; transform: rotate(0deg); }
          50%  { stroke-dashoffset: 56.5; transform: rotate(180deg); }
          100% { stroke-dashoffset: 226.19; transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sso-loader-shine { animation: none; display: none; }
          .sso-loader-ring-progress { animation-duration: 2.4s; }
        }
      `}</style>
    </div>
  )
}
