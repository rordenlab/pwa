// "Install as App": Chromium offers a native prompt via `beforeinstallprompt`; other browsers install
// from their own menus, so we explain how. Registered at startup: the event fires once, early.
import { bump } from './nv'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallPrompt | undefined

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // we show it from File ▸ Install as App… instead of the mini-infobar
  deferred = e as InstallPrompt
  bump()
})
addEventListener('appinstalled', () => {
  deferred = undefined
  bump()
})

/** Running as an installed app (its own window), so the command is not needed. */
export const isInstalled = () =>
  matchMedia('(display-mode: standalone), (display-mode: window-controls-overlay)').matches

/** Show the browser's install prompt; false if this browser has none (show instructions instead). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const p = deferred
  deferred = undefined // a prompt can be shown only once
  await p.prompt()
  bump()
  return true
}

/** How to install in browsers without a prompt. */
export function installSteps(ua = navigator.userAgent): string {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'In Safari, tap the Share button, then “Add to Home Screen”.'
  if (/Firefox\//.test(ua))
    return 'Firefox cannot install web apps. MRIvue works fully in this tab; to install it, open this page in Chrome, Edge or Safari.'
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua))
    return 'In Safari, choose File ▸ Add to Dock (macOS Sonoma or later).'
  return 'Use the install icon at the right of the address bar, or the browser menu ▸ “Install MRIvue…” (Chrome) / “Apps ▸ Install this site as an app” (Edge).'
}
