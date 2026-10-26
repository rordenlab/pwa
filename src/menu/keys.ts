// Shortcuts are written "Mod+Shift+S"; Mod = ⌘ on macOS, Ctrl elsewhere. Matched on
// KeyboardEvent.code, because Alt+L types "¬" on macOS (plan §9).
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const CODE: Record<string, string> = { ',': 'Comma', '[': 'BracketLeft', ']': 'BracketRight', Enter: 'Enter' }
const code = (k: string) => CODE[k] ?? (/^\d$/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`)

export function matches(shortcut: string, e: KeyboardEvent): boolean {
  const parts = shortcut.split('+')
  const key = parts.pop() as string
  const mod = parts.includes('Mod')
  return (
    e.code === code(key) &&
    (isMac ? e.metaKey : e.ctrlKey) === mod &&
    (isMac ? e.ctrlKey : e.metaKey) === false &&
    e.shiftKey === parts.includes('Shift') &&
    e.altKey === parts.includes('Alt')
  )
}

const MAC: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥' }
export const label = (shortcut: string) =>
  isMac
    ? shortcut
        .split('+')
        .map((p) => MAC[p] ?? p)
        .join('')
    : shortcut.replace('Mod', 'Ctrl')
