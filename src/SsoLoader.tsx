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
 * Each app must have public/images/loader.png (same file, copied per app —
 * there's no cross-app static asset server, so the image ships with every
 * app's own public/ folder) as the fallback mark. No Tailwind config changes
 * required otherwise — the --background / --muted-foreground CSS variables
 * are read from the consuming app, and the shine keyframes are scoped inline
 * so this drops into any app as-is.
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
}

export function SsoLoader({
  label = 'Signing you in…',
  imageSrc = '/images/loader.png',
  fullScreen = true,
  ssoServerUrl,
  appSlug,
}: SsoLoaderProps) {
  const { branding } = useAppBranding(ssoServerUrl, appSlug)
  const dynamicIcon = branding?.icon ?? null
  const useDynamicImage = isImageIcon(dynamicIcon)
  const useDynamicEmoji = !!dynamicIcon && !useDynamicImage

  // `fixed inset-0` centers against the viewport directly, regardless of
  // ancestor height — `min-h-screen` only reserves height if it's actually
  // the tallest box in the flow, which isn't guaranteed once this drops into
  // an arbitrary consuming app's route tree.
  const wrapperClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-background'
    : 'flex items-center justify-center'

  return (
    <div className={wrapperClass}>
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Ring sits in its own layer around the mark rather than on the same
            overflow-hidden circle as the logo — the ring's stroke needs to
            extend past the mark's edge, which overflow-hidden would clip. */}
        <div className="sso-loader-ring-wrap relative flex h-20 w-20 items-center justify-center">
          <svg className="sso-loader-ring absolute inset-0 h-full w-full" viewBox="0 0 80 80" aria-hidden="true">
            <circle className="sso-loader-ring-track" cx="40" cy="40" r="36" fill="none" strokeWidth="3" />
            <circle className="sso-loader-ring-progress" cx="40" cy="40" r="36" fill="none" strokeWidth="3" />
          </svg>
          <div className="sso-loader-mark relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full">
            {useDynamicEmoji ? (
              <span className="relative z-10 flex h-full w-full items-center justify-center text-2xl leading-none">
                {dynamicIcon}
              </span>
            ) : (
              <img
                src={useDynamicImage ? (dynamicIcon as string) : imageSrc}
                alt=""
                className="relative z-10 h-full w-full object-contain"
              />
            )}
            <span className="sso-loader-shine" aria-hidden="true" />
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
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
        }
        .sso-loader-ring-progress {
          stroke: currentColor;
          stroke-linecap: round;
          transform-origin: 40px 40px;
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
