import { readFileSync } from 'node:fs'
import { expect, ready, test } from './util'

// The uncached-sample check below fails a fetch on purpose while offline.
test.use({ allowedConsole: /Failed to load resource: net::ERR_(FAILED|INTERNET_DISCONNECTED)/ })

test('production build: installable manifest, offline reload, cached samples and templates', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  // The online pass uses the real pinned CDN: Playwright routing would bypass the service worker cache.
  test.skip(!!process.env.OFFLINE_ONLY, 'needs network for the first pass')
  await page.goto('./')
  await ready(page)

  const manifest = await (await page.request.get('manifest.webmanifest')).json()
  expect(manifest.scope).toBe('/pwa/')
  expect(manifest.start_url).toBe('/pwa/')
  expect(manifest.display_override).toContain('window-controls-overlay')
  expect(manifest.file_handlers[0].accept['application/octet-stream']).toContain('.nvd')
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true)
  const brief = await page.request.get('llms.txt')
  expect(brief.ok()).toBe(true)
  expect(await brief.text()).toContain('MRIvue scripting brief')

  // Wait for the service worker to control the page.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await ready(page)
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  // Online: run a CDN template and a same-origin mesh template so both get cached.
  const run = async (name: string) => {
    await page.locator('.menubar-trigger', { hasText: 'Script' }).click()
    await page.getByRole('menuitem', { name: 'Templates', exact: true }).hover()
    await page.getByRole('menuitem', { name, exact: true }).click() // runs it
    await expect(page.locator('.output')).toContainText(/Done|line|Could not/, { timeout: 30_000 })
    await expect(page.locator('.output .error')).toHaveCount(0)
  }
  await run('basic')
  await run('fmri_mesh')

  // Offline: the app shell, shaders/matcaps and cached data all come from the service worker.
  expect(await page.evaluate(async () => (await caches.keys()).sort())).toEqual(
    expect.arrayContaining(['demo-images', 'samples']),
  )
  await context.setOffline(true)
  await page.reload()
  await ready(page)
  await run('fmri_mesh')
  await run('basic')
  expect(await page.evaluate(async () => (await fetch('/pwa/llms.txt')).ok)).toBe(true) // precached: works offline
  await page.locator('.menubar-trigger', { hasText: 'View' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Render', exact: true }).click()
  const r = page.locator('[data-section="render"]')
  await r.getByLabel('MatCap').selectOption('Cortex')
  await expect.poll(() => page.evaluate(() => nv.volumeMatcap.length)).toBeGreaterThan(10)

  // Uncached data fails clearly instead of hanging.
  await page.locator('.menubar-trigger', { hasText: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Open Sample', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'Volumes', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'CT_Abdo.nii.gz', exact: true }).click()
  await expect(page.locator('.status')).toContainText('Could not load CT_Abdo.nii.gz')
  await context.setOffline(false)
  expect(errors).toEqual([])
})

test('every pinned CDN sample exists upstream', async ({ request }) => {
  // Local demo-images clones can hold untracked files that the CDN does not serve.
  test.skip(!!process.env.OFFLINE_ONLY, 'needs network')
  const { cdn, groups } = JSON.parse(readFileSync('src/catalog.json', 'utf8')) as {
    cdn: string
    groups: Record<string, string[]>
  }
  const remote = Object.values(groups)
    .flat()
    .filter((p) => !p.startsWith('samples/'))
  const status = await Promise.all(remote.map(async (p) => [p, (await request.head(cdn + p)).status()]))
  expect(status.filter(([, s]) => s !== 200)).toEqual([])
})

test('Chrome considers the built app installable', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'installability check uses Chrome DevTools')
  await page.goto('./')
  await ready(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  expect(installabilityErrors).toEqual([])
})
