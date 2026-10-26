// Per-viewer preferences in localStorage (guarded: storage can be unavailable).
import { SLICE_TYPE } from '@niivue/niivue/webgl2'
import { bump, nv } from './nv'

export const prefs = {
  theme: 'system' as 'system' | 'light' | 'dark',
  startupView: SLICE_TYPE.MULTIPLANAR as number,
  radiological: false,
  bitmapZoom: 1,
  /** Multi-sample antialiasing (MSAA): smoother edges, more GPU work. */
  antialias: true,
  /** Canvas resolution: device pixels (high), capped device pixels (auto), or CSS pixels (standard). */
  resolution: 'auto' as Resolution,
  /** Open the MNI152 template when MRIvue starts without a script link or file. */
  startTemplate: true,
}
export type Resolution = 'auto' | 'high' | 'standard'
export const RESOLUTIONS: Record<Resolution, string> = {
  auto: 'Auto',
  high: 'High-DPI',
  standard: 'Standard (1×)',
}
const KEY = 'niivue-pwa:prefs'
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) ?? '{}'))
} catch {}

function applyTheme() {
  if (prefs.theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = prefs.theme
}

/** Startup. Radiological is a default: later only its own preference change reapplies it. */
export function applyPrefs() {
  applyTheme()
  if (nv.isRadiological !== prefs.radiological) nv.isRadiological = prefs.radiological // avoid a false dirty
}

/** Canvas pixels per CSS pixel. Phones report 3+, which triples the work for little gain, so Auto caps at 2. */
export const pixelRatio = (r: Resolution = prefs.resolution) =>
  r === 'standard' ? 1 : r === 'high' ? devicePixelRatio : Math.min(devicePixelRatio, 2)

/** Change antialiasing or resolution now: core rebuilds the GL view and keeps the scene. */
export async function setQuality(p: { antialias?: boolean; resolution?: Resolution }) {
  savePrefs(p)
  await nv.reinitializeView({ isAntiAlias: prefs.antialias, forceDevicePixelRatio: pixelRatio() })
  bump()
}

export function savePrefs(p: Partial<typeof prefs>) {
  Object.assign(prefs, p)
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {}
  applyTheme()
  if (p.radiological !== undefined) nv.isRadiological = p.radiological
}
