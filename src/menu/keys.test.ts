import { expect, test } from 'vitest'
import { isMac, label, matches } from './keys'

const mod = isMac ? { metaKey: true } : { ctrlKey: true }
const ev = (o: Partial<KeyboardEvent>) =>
  ({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...o }) as KeyboardEvent

test('shortcut matching uses physical key codes', () => {
  expect(matches('Mod+O', ev({ code: 'KeyO', ...mod }))).toBe(true)
  expect(matches('Mod+O', ev({ code: 'KeyO', ...mod, shiftKey: true }))).toBe(false)
  expect(matches('Alt+L', ev({ code: 'KeyL', altKey: true, key: '¬' }))).toBe(true)
  expect(matches('Mod+,', ev({ code: 'Comma', ...mod }))).toBe(true)
  expect(label('Mod+Shift+S')).toBe(isMac ? '⌘⇧S' : 'Ctrl+Shift+S')
})
