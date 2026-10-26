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
      await expect(out).toContainText('Done', { timeout: 20_000 })
      expect(await page.evaluate(() => nv.volumes.length + nv.meshes.length)).toBeGreaterThan(0)
      expect(errors).toEqual([])
    })
  }

  test('Stop interrupts an animation', async ({ page }) => {
    await serveDemo(page)
    await page.goto('./')
    await ready(page)
    await runTemplate(page, 'shaders')
    await expect(page.getByRole('button', { name: 'Stop script' })).toBeVisible()
    await page.waitForTimeout(1500)
    await page.locator('.cm-content').click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.output .error')).toContainText('Stopped')
    await expect(page.getByRole('button', { name: 'Run script' })).toBeVisible()
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
  await expect(page.locator('.output')).toContainText('Done', { timeout: 20_000 })
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
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>('button[aria-label="Stop script"]')?.click(),
  ) // Stop
  await expect(page.locator('.output .error')).toContainText('Stopped')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Run script' })).toBeVisible()

  // A layer loaded now wins over an earlier resolution of the same name.
  await drop(page, ['fslmean.nii.gz>scan.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await run("await nv.addVolume({ url: 'scan' })\nconsole.log('dims', nv.volumes[1].dims.join('x'))")
  await expect(page.locator('.output')).toContainText('Done', { timeout: 20_000 })
  const first = await page.locator('.output').textContent()
  await page.evaluate(() => nv.removeAllVolumes())
  await drop(page, ['z_FDR_0.01_hand.nii.gz>scan.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await run("await nv.addVolume({ url: 'scan' })\nconsole.log('dims', nv.volumes[1].dims.join('x'))")
  await expect(page.locator('.output')).toContainText('Done', { timeout: 20_000 })
  expect(await page.locator('.output').textContent()).not.toBe(first)
  expect(await page.evaluate(() => nv.volumes[0].dims.join() === nv.volumes[1].dims.join())).toBe(true)

  // A script loading a document takes over the scene as a new, unsaved-location document.
  const nvd = await page.evaluate(() => Array.from(nv.serializeDocument()))
  await page.evaluate((b) => {
    ;(window as unknown as { testDoc: File }).testDoc = new File([new Uint8Array(b)], 'other.nvd')
  }, nvd)
  await run('await nv.loadDocument(window.testDoc)')
  await expect(page.locator('.output')).toContainText('Done', { timeout: 20_000 })
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
  await expect(page.locator('.output')).toContainText('Done', { timeout: 20_000 })
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

test('atlas template: status bar names the region under the crosshair', async ({ page }) => {
  test.setTimeout(120_000)
  await serveDemo(page)
  await page.goto('./')
  await ready(page)
  await runTemplate(page, 'atlas')
  await expect(page.locator('.output')).toContainText('Done', { timeout: 100_000 })
  await page.evaluate(() => nv.setCrosshairPos([-38, -20, 58])) // MNI mm, left precentral gyrus
  await expect(page.locator('.location')).toContainText('Precentral_L')
})

test('A1: a shared link fills the editor and runs only on Run', async ({ page }) => {
  const code = "await nv.loadVolumes([{ url: 'https://example.test/fslmean.nii.gz' }])"
  await page.route('https://example.test/**', (r) =>
    r.fulfill({
      body: readFileSync('tests/fixtures/fslmean.nii.gz'),
      headers: { 'access-control-allow-origin': '*' },
    }),
  )
  await page.goto(`./#script=${Buffer.from(code).toString('base64url')}`)
  await ready(page)
  await expect(page.locator('.cm-content')).toHaveText(code)
  await expect(page.getByRole('note')).toContainText('review before running')
  expect(new URL(page.url()).hash).toBe('') // a reload does not re-import
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => nv.volumes.length)).toBe(0)
  await page.getByRole('button', { name: 'Run shared script' }).click()
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
})

test('tract groups: the template shows 3 groups; the Groups dialog shows, hides and colors groups', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await serveDemo(page)
  await page.goto('./')
  await ready(page)
  await runTemplate(page, 'tract_groups')
  await expect(page.locator('.output')).toContainText('Done', { timeout: 100_000 })
  const n = await page.evaluate(() => nv.getTractGroups(0).length)
  const listed = () => page.evaluate(() => Object.keys(nv.meshes[0].tractOptions?.groupColors ?? {}).length)
  const tracts = page.locator('[data-section="tracts"]')
  await expect(tracts.getByLabel('Color by')).toHaveValue('group')
  const open = tracts.getByRole('button', { name: 'Groups' })
  await expect(open).toHaveText(`3/${n} shown…`)
  await open.click()
  const dlg = page.getByRole('dialog')
  const all = dlg.getByLabel('Show all groups')
  expect(await all.evaluate((e: HTMLInputElement) => e.indeterminate)).toBe(true)
  await all.check()
  await expect.poll(listed).toBe(n)
  await all.uncheck()
  await expect.poll(listed).toBe(0)
  const first = await page.evaluate(() => nv.getTractGroups(0)[0])
  await dlg.getByLabel('Filter groups').fill(first)
  await dlg.getByLabel(`Show ${first}`, { exact: true }).check()
  await expect.poll(listed).toBe(1)
  await dlg.getByLabel(`${first} color`).fill('#ff0000')
  await expect
    .poll(() => page.evaluate((g) => nv.meshes[0].tractOptions?.groupColors?.[g], first))
    .toEqual([255, 0, 0, 255])
  await dlg.getByRole('button', { name: 'Show all, original colors' }).click()
  await expect.poll(() => page.evaluate(() => nv.meshes[0].tractOptions?.groupColors)).toBe(null)
  await dlg.getByRole('button', { name: 'Done' }).click()
  await expect(tracts.getByLabel('Color by')).toHaveValue('direction')
})

test('scripting rail: toggles the editor; pasting a script outside fields opens it for review', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  const editor = page.getByRole('button', { name: 'Script editor' })
  await expect(editor).toHaveAttribute('data-state', 'hidden')
  await editor.click()
  await expect(editor).toHaveAttribute('data-state', 'shown')
  await expect(page.locator('.cm-content')).toBeVisible()
  await editor.click()
  await expect(editor).toHaveAttribute('data-state', 'hidden')
  const code = "await nv.loadVolumes([{ url: 'spm152' }])"
  await page.evaluate((text) => {
    const data = new DataTransfer()
    data.setData('text/plain', ['```js', text, '```'].join('\n'))
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
  }, code)
  await expect(page.locator('.cm-content')).toHaveText(code) // Markdown fence removed
  await expect(page.getByRole('note')).toContainText('came from a paste')
  expect(await page.evaluate(() => nv.volumes.length)).toBe(0) // not run
})

test('nv.resetScene() empties the scene and restores default settings', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  const initial = await page.evaluate(() => [...nv.backgroundColor])
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await page.evaluate(() => {
    nv.backgroundColor = [1, 0, 0, 1]
    nv.mosaicString = 'A 0'
    nv.setClipPlanes([[0.2, 180, 0]])
    nv.isRadiological = true // like the radiological preference: scripts still get the fixed default
  })
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.cm-content').click()
  await page.keyboard.insertText('await nv.resetScene()')
  await page.keyboard.press('Shift+Enter')
  await expect(page.locator('.output')).toContainText('Done', { timeout: 20_000 })
  expect(
    await page.evaluate(() => ({
      layers: nv.volumes.length + nv.meshes.length,
      bg: [...nv.backgroundColor],
      mosaic: nv.mosaicString,
      radiological: nv.isRadiological,
      clip: nv.getClipPlaneDepthAziElev(0)[0],
    })),
  ).toEqual({ layers: 0, bg: initial, mosaic: '', radiological: false, clip: expect.any(Number) })
  expect(Math.abs(await page.evaluate(() => nv.getClipPlaneDepthAziElev(0)[0]))).toBeGreaterThan(1.5) // inactive
})

test('label layers (atlases) show only controls that have an effect', async ({ page }) => {
  test.setTimeout(120_000)
  await serveDemo(page)
  await page.goto('./')
  await ready(page)
  await runTemplate(page, 'hide_curves')
  await expect(page.locator('.output')).toContainText('Done', { timeout: 100_000 })
  const ml = page.locator('[data-section="meshlayers"]')
  await expect(ml).toContainText('Label layer')
  await expect(ml.getByLabel(/^Colormap/)).toHaveCount(0)
  await expect(ml.getByLabel('Opacity')).toHaveCount(1)
  await runTemplate(page, 'atlas')
  await expect(page.locator('.output')).toContainText('Done', { timeout: 100_000 })
  await page.locator('[role=treeitem]', { hasText: 'aal' }).click()
  const props = page.locator('[data-section="props"]')
  await expect(props).toContainText('Atlas')
  await expect(props.getByLabel(/^Colormap/)).toHaveCount(0)
  await expect(props.getByLabel('Opacity')).toHaveCount(1)
  await expect(props.getByLabel('Interpolation')).toHaveValue('Nearest') // core default for label data
})

test('audit round 8: a label table stays with its volume when volumes change while it loads', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz', 'z_FDR_0.01_hand.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  let release = () => {}
  const gate = new Promise<void>((r) => {
    release = r
  })
  const requested = new Promise<void>((seen) =>
    page.route('https://example.test/**', async (route) => {
      seen()
      await gate
      await route.fulfill({
        body: JSON.stringify({ R: [0, 255], G: [0, 0], B: [0, 0], labels: ['', 'one'] }),
        headers: { 'access-control-allow-origin': '*' },
      })
    }),
  )
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.cm-content').click()
  await page.keyboard.insertText("await nv.setColormapLabelFromUrl(0, 'https://example.test/labels.json')")
  await page.keyboard.press('Shift+Enter')
  await requested
  await page.evaluate(() => nv.removeVolume(0))
  release()
  await expect(page.locator('.output .error')).toContainText('was removed')
  expect(await page.evaluate(() => nv.volumes.map((v) => !!v.colormapLabel))).toEqual([false])
})
