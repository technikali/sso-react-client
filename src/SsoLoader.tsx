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
 * app's own public/ folder). No Tailwind config changes required otherwise —
 * the --background / --muted-foreground CSS variables are read from the
 * consuming app, and the shine keyframes are scoped inline so this drops into
 * any app as-is.
 */
export interface SsoLoaderProps {
  /** Status text under the mark. Default: 'Signing you in…' */
  label?: string
  /** Path to the loader image. Default: '/images/loader.png' */
  imageSrc?: string
  /** Render full-screen (fixed to the viewport, centered) or inline. Default: true */
  fullScreen?: boolean
}

export function SsoLoader({ label = 'Signing you in…', imageSrc = '/images/loader.png', fullScreen = true }: SsoLoaderProps) {
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
        <div className="sso-loader-mark relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full">
          <img src={imageSrc} alt="" className="relative z-10 h-full w-full object-contain" />
          <span className="sso-loader-shine" aria-hidden="true" />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sso-loader-spinner" aria-hidden="true" />
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
        .sso-loader-spinner {
          height: 1rem;
          width: 1rem;
          border-radius: 9999px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          animation: sso-loader-spin 0.7s linear infinite;
        }
        @keyframes sso-loader-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sso-loader-shine { animation: none; display: none; }
          .sso-loader-spinner { animation-duration: 1.4s; }
        }
      `}</style>
    </div>
  )
}
