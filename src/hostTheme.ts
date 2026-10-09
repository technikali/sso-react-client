/**
 * Reads the look of the app the AppSwitcher sits in, so its menu feels native
 * there: the header's surface and text colours, the app's primary colour from
 * its own theme variables, its corner radius and its font. Everything else
 * (borders, muted text, hover) is mixed from those, so it also follows the
 * app's light/dark mode automatically.
 */

export interface SwitcherPalette {
  background: string
  foreground: string
  /** The app's brand/primary colour (outlines, tints). */
  accent: string
  /** Readable text shade of the brand colour on this background. */
  accentText: string
  muted: string
  border: string
  hover: string
  accentBackground: string
  radius: string
  fontFamily: string
  shadow: string
}

type Rgba = [number, number, number, number]

function parseRgb(value: string | null | undefined): Rgba | null {
  const m = value?.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i)
  if (!m) return null
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), a]
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Resolves any CSS colour (hex, hsl, named, var-based) to rgb via the browser. */
function resolveColor(value: string, scope: Element): Rgba | null {
  if (!value || typeof CSS === 'undefined' || !CSS.supports('color', value)) return null
  const probe = document.createElement('span')
  probe.style.color = value
  probe.style.display = 'none'
  scope.appendChild(probe)
  const rgb = parseRgb(getComputedStyle(probe).color)
  probe.remove()
  return rgb
}

/** Blend `c` toward `to` until it reaches the target contrast on `bg` (keeps the brand hue readable). */
function readable(c: Rgba, to: Rgba, bg: Rgba, target = 4.5): Rgba {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const mixed: Rgba = [c[0] + (to[0] - c[0]) * t, c[1] + (to[1] - c[1]) * t, c[2] + (to[2] - c[2]) * t, 1]
    if (contrast(mixed, bg) >= target) return mixed
  }
  return to
}

const css = (c: Rgba) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`

/** First opaque background behind the trigger (its header/toolbar), else the page's. */
function surfaceOf(el: Element): { bg: Rgba; host: Element } {
  // Start above the trigger: its own (hover/button) background isn't the surface.
  for (let node: Element | null = el.parentElement; node; node = node.parentElement) {
    const bg = parseRgb(getComputedStyle(node).backgroundColor)
    if (bg && bg[3] > 0.85) return { bg, host: node }
  }
  return { bg: [255, 255, 255, 1], host: document.body }
}

/** The app's primary colour, from whichever design system it uses. */
const ACCENT_VARS = [
  '--hud-accent',                // core.bansud HUD
  '--primary',                   // shadcn/ui (hsl triplet or full colour)
  '--mui-palette-primary-main',  // MUI CSS variables
  '--heroui-primary',            // HeroUI / NextUI (hsl triplet)
  '--gh-accent-fg',              // epcms GitHub-like tokens
  '--color-primary',             // Tailwind v4 theme
  '--accent',
]

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    || (document.body ? getComputedStyle(document.body).getPropertyValue(name).trim() : '')
}

function asColor(raw: string): string {
  // shadcn/HeroUI store "222 47% 11%" (no hsl()); MUI/others store full colours.
  return /^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%(\s*\/\s*[\d.]+%?)?$/.test(raw) ? `hsl(${raw})` : raw
}

function radiusVar(): string | null {
  for (const name of ['--radius', '--heroui-radius-medium', '--radius-lg']) {
    const v = cssVar(name)
    if (v && CSS.supports('border-radius', v)) return v
  }
  return null
}

export function deriveHostPalette(trigger: Element, fallbackDark: boolean, overrides: Partial<SwitcherPalette> = {}): SwitcherPalette {
  const surface = surfaceOf(trigger)
  const host = surface.host
  // Explicit colours (e.g. from an MUI theme) take part in every derived shade.
  const bg = (overrides.background && resolveColor(overrides.background, trigger)) || surface.bg
  const dark = luminance(bg) < 0.25

  let fg = (overrides.foreground && resolveColor(overrides.foreground, trigger))
    || parseRgb(getComputedStyle(host).color) || parseRgb(getComputedStyle(trigger).color)
  if (!fg || contrast(fg, bg) < 4.5) fg = dark ? [229, 233, 242, 1] : [17, 24, 39, 1]

  let accent: Rgba | null = (overrides.accent && resolveColor(overrides.accent, trigger)) || null
  for (const name of accent ? [] : ACCENT_VARS) {
    const raw = cssVar(name)
    const c = raw ? resolveColor(asColor(raw), trigger) : null
    // The app's own primary is used even when it is a light brand colour
    // (e.g. HRIS amber); text then uses a readable shade of it.
    if (c && c[3] > 0) { accent = c; break }
  }
  accent ??= fallbackDark || dark ? [143, 176, 255, 1] : [29, 78, 216, 1]

  const background = css(bg)
  const foreground = css(fg)
  const accentCss = css(accent)
  const accentText = css(readable(accent, fg, bg))
  const radius = radiusVar()

  return {
    ...{
    background,
    foreground,
    accent: accentCss,
    accentText,
    muted: `color-mix(in srgb, ${foreground} 62%, ${background})`,
    border: `color-mix(in srgb, ${foreground} 14%, ${background})`,
    hover: `color-mix(in srgb, ${foreground} 7%, ${background})`,
    accentBackground: `color-mix(in srgb, ${accentCss} 14%, ${background})`,
    radius: radius ?? '12px',
    fontFamily: getComputedStyle(trigger).fontFamily || 'system-ui, sans-serif',
    shadow: dark ? '0 18px 50px -12px rgba(0,0,0,.7)' : '0 18px 50px -12px rgba(15,23,42,.28)',
    },
    ...(overrides.radius ? { radius: overrides.radius } : {}),
    ...(overrides.fontFamily ? { fontFamily: overrides.fontFamily } : {}),
    ...(overrides.accentText ? { accentText: overrides.accentText } : {}),
  }
}

export function paletteVars(p: SwitcherPalette): Record<string, string> {
  return {
    '--bsw-bg': p.background,
    '--bsw-fg': p.foreground,
    '--bsw-accent': p.accent,
    '--bsw-accent-text': p.accentText,
    '--bsw-muted': p.muted,
    '--bsw-border': p.border,
    '--bsw-hover': p.hover,
    '--bsw-accent-bg': p.accentBackground,
    '--bsw-radius': p.radius,
    '--bsw-font': p.fontFamily,
    '--bsw-shadow': p.shadow,
  }
}
