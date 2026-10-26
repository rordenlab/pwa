import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { drop, expect, ready, test } from './util'

// Pinned CDN files come from a local niivue-demo-images clone when present (fast, offline);
// otherwise the real pinned CDN is used. Templates are required acceptance, so they never skip.
const DEMO = process.env.DEMO_IMAGES ?? '../niivue-demo-images' // a clone next to this repo
const TEMPLATES = readdirSync('src/script/templates').map((f) => f.slice(0, -3))
const STOPPED = new Set(['shaders']) // long animation: exercised via Stop instead

async function serveDemo(page: Page) {
  if (!existsSync(DEMO)) return
  await page.route(/cdn\.jsdelivr\.net\/gh\/niivue\/niivue-demo-images@[0-9a-f]{40}\/(.*)$/, (route) => {
    const path = new URL(route.request().url()).pathname.split(/@[0-9a-f]{40}\//)[1]
    route.fulfill({ body: readFileSync(`${DEMO}/${path}`), headers: { 'access-control-allow-origin': '*' } })
  })
}

async function runTemplate(page: Page, name: string) {
  await page.locator('.menubar-trigger', { hasText: 'Script' }).click()
  await page.getByRole('menuitem', { name: 'Templates', exact: true }).hover()
  await page.getByRole('menuitem', { name, exact: true }).click()
  // Choosing a template runs it.
}

test.describe('M3 templates', () => {
  for (const name of TEMPLATES.filter((t) => !STOPPED.has(t))) {
    test(`template ${name} runs clean`, async ({ page }) => {
      // Software rendering (headless, no GPU) with MSAA on: tract-heavy templates take ~50 s.
      test.setTimeout(120_000)
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      await serveDemo(page)
      await page.goto('./')
      await ready(page)
      await runTemplate(page, name)
      const out = page.locator('.output')
      await expect(out.locator('.info, .error').last()).toBeVisible({ timeout: 100_000 })
      await expect(out.locator('.error')).toHaveCount(0)
      await expect(out).toContainText('Done')
      expect(await page.evaluate(() => nv.volumes.length + nv.meshes.length)).toBeGreaterThan(0)
      expect(errors).toEqual([])
    })
  }

  test('Stop interrupts an animation', async ({ page }) => {
    await serveDemo(page)
    await page.goto('./')
    await ready(page)
    await runTemplate(page, 'shaders')
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
    await page.waitForTimeout(1500)
    await page.locator('.cm-content').click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.output .error')).toContainText('Stopped')
    await expect(page.getByRole('button', { name: 'Run' })).toBeVisible()
  })
})

test('M3: unknown local file prompts once, then resolves from cache', async ({ page }) => {
  const fixture = readFileSync('tests/fixtures/fslmean.nii.gz').toString('base64')
  await page.goto('./')
  await ready(page)
  await page.evaluate((b) => {
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [
      {
        kind: 'file',
        name: 'mydata.nii.gz',
        getFile: async () => new File([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], 'mydata.nii.gz'),
      },
    ]
  }, fixture)
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.cm-content').click()
  await page.keyboard.insertText(
    "await nv.addVolume({ url: 'mydata' })\nawait nv.addVolume({ url: 'mydata' })\nconsole.log(nv.volumes.length)",
  )
  await page.keyboard.press('Shift+Enter')
  await expect(page.getByRole('dialog')).toContainText('Locate mydata')
  await page.getByRole('button', { name: 'Locate…' }).click()
  await expect(page.locator('.output')).toContainText('Done')
  await expect(page.locator('.output')).toContainText('2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('M3: script errors report the line; cancel Locate fails the run', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.cm-content').click()
  await page.keyboard.insertText("console.log('a')\nnv.notAFunction()")
  await page.keyboard.press('Shift+Enter')
  await expect(page.locator('.output .error')).toContainText('line 2')
  await page.keyboard.press('ControlOrMeta+KeyA')
  await page.keyboard.insertText("await nv.addVolume({ url: 'nowhere' })")
  await page.keyboard.press('Shift+Enter')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.output .error')).toContainText("Could not find 'nowhere'")
})

test('M3: audit round 2 (concurrent Locate + Stop, stale resolver cache, script loadDocument)', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  await page.keyboard.press('ControlOrMeta+KeyJ')
  const editor = page.locator('.cm-content')
  const run = async (code: string) => {
    await editor.click()
    await page.keyboard.press('ControlOrMeta+KeyA')
    await page.keyboard.insertText(code)
    await page.keyboard.press('Shift+Enter')
  }
  // Two concurrent unknown files: one dialog at a time; when the run ends, no dialog is left behind.
  await run("await Promise.all([nv.addVolume({ url: 'missingA' }), nv.addVolume({ url: 'missingB' })])")
  await expect(page.getByRole('dialog')).toContainText('Locate missingA')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.output .error')).toContainText("Could not find 'missingA'")
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Stop while a Locate dialog is open settles the run and closes the dialog.
  await run("await Promise.all([nv.addVolume({ url: 'missingC' }), nv.addVolume({ url: 'missingD' })])")
  await expect(page.getByRole('dialog')).toContainText('Locate missingC')
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.script-bar button')?.click()) // Stop
  await expect(page.locator('.output .error')).toContainText('Stopped')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Run' })).toBeVisible()

  // A layer loaded now wins over an earlier resolution of the same name.
  await drop(page, ['fslmean.nii.gz>scan.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await run("await nv.addVolume({ url: 'scan' })\nconsole.log('dims', nv.volumes[1].dims.join('x'))")
  await expect(page.locator('.output')).toContainText('Done')
  const first = await page.locator('.output').textContent()
  await page.evaluate(() => nv.removeAllVolumes())
  await drop(page, ['z_FDR_0.01_hand.nii.gz>scan.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await run("await nv.addVolume({ url: 'scan' })\nconsole.log('dims', nv.volumes[1].dims.join('x'))")
  await expect(page.locator('.output')).toContainText('Done')
  expect(await page.locator('.output').textContent()).not.toBe(first)
  expect(await page.evaluate(() => nv.volumes[0].dims.join() === nv.volumes[1].dims.join())).toBe(true)

  // A script loading a document takes over the scene as a new, unsaved-location document.
  const nvd = await page.evaluate(() => Array.from(nv.serializeDocument()))
  await page.evaluate((b) => {
    ;(window as unknown as { testDoc: File }).testDoc = new File([new Uint8Array(b)], 'other.nvd')
  }, nvd)
  await run('await nv.loadDocument(window.testDoc)')
  await expect(page.locator('.output')).toContainText('Done')
  await expect(page).toHaveTitle('MRIvue: other')
})

test('M3: failed script loadDocument stops the script; files dropped on the editor are not pasted', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.cm-content').click()
  await page.keyboard.insertText(
    "await nv.loadDocument(new File(['nope'], 'bad.nvd'))\nconsole.log('should not run')",
  )
  await page.keyboard.press('Shift+Enter')
  await expect(page.locator('.output .error')).toBeVisible()
  await expect(page.locator('.output')).not.toContainText('should not run')
  expect(await page.evaluate(() => nv.volumes.length)).toBe(1) // previous scene restored

  // Drop a volume onto the editor: it joins the scene and the script text is untouched.
  const before = await page.locator('.cm-content').textContent()
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array(400)], 'x.txt.nii'))
    document
      .querySelector('.cm-content')
      ?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(300)
  expect(await page.locator('.cm-content').textContent()).toBe(before)
})

test('M3: audit round 3 (script loads queue with Close All; failed same-name load keeps the source)', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  // A slow remote volume: Close All issued during the load runs after it, leaving an empty scene.
  const bytes = readFileSync('tests/fixtures/fslmean.nii.gz')
  await page.route('**/slow/scan.nii.gz', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.fulfill({ body: bytes })
  })
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.cm-content').click()
  await page.keyboard.insertText("await nv.addVolume({ url: location.origin + '/pwa/slow/scan.nii.gz' })")
  await page.keyboard.press('Shift+Enter')
  await page.waitForTimeout(300)
  // Close All waits for the load, then asks about the now-unsaved scene.
  page.once('dialog', (d) => d.accept())
  await page.locator('.menubar-trigger', { hasText: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Close All', exact: true }).click()
  await expect(page.locator('.output')).toContainText('Done')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(0)

  // A corrupt file with a loaded layer's name fails without replacing that layer's source.
  await drop(page, ['fslmean.nii.gz>scan.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array([1, 2, 3])], 'scan.nii.gz'))
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true }))
  })
  await expect(page.locator('.status')).toContainText('Failed to load scan.nii.gz')
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+KeyA')
  await page.keyboard.insertText(
    "await nv.addVolume({ url: 'scan' })\nconsole.log('dims', nv.volumes[1].dims.join('x'))",
  )
  await expect(page.locator('.cm-content')).toContainText("url: 'scan'") // editor updated before running
  await page.keyboard.press('Shift+Enter')
  await expect(page.locator('.output')).toContainText('dims 3x64x64x36')
})
