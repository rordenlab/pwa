import { readFileSync } from 'node:fs'
import { test as base, expect, type Page } from '@playwright/test'

/** Dispatch a window drop of fixture files (tests/fixtures/<name>). */
/** Fixture names, optionally renamed: 'fixture.nii.gz>as.nii.gz'. */
export async function drop(page: Page, names: string[], init: { shiftKey?: boolean } = {}) {
  const files = names.map((spec) => {
    const [fixture, as = fixture] = spec.split('>')
    return { n: as, b: readFileSync(`tests/fixtures/${fixture}`).toString('base64') }
  })
  await page.evaluate(
    ({ files, init }) => {
      const dt = new DataTransfer()
      for (const { n, b } of files)
        dt.items.add(new File([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], n))
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true, ...init }))
    },
    { files, init },
  )
}

export const ready = (page: Page) => page.waitForFunction(() => (globalThis as { nv?: { gl?: unknown } }).nv)

// Every test fails on uncaught page errors or console errors (plan M5 acceptance).
// Known-benign core warnings are console.warn, not errors.
export const test = base.extend<{ consoleGuard: undefined; allowedConsole: RegExp | null }>({
  allowedConsole: [null, { option: true }],
  consoleGuard: [
    async ({ page, allowedConsole }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on(
        'console',
        (m) => m.type() === 'error' && !allowedConsole?.test(m.text()) && errors.push(m.text()),
      )
      await use(undefined)
      expect(errors, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }
