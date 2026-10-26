import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { drop, expect, ready, test } from './util'

// Tree rows as [name, checked] must mirror nv after every step.
async function treeMatchesNv(page: Page) {
  const tree = await page.$$eval('[role=treeitem]', (rows) =>
    rows.map((r) => [
      r.querySelector('.name')?.textContent,
      (r.querySelector('input') as HTMLInputElement).checked,
    ]),
  )
  const scene = await page.evaluate(() => [
    ...nv.volumes.map((v) => [v.name, v.visible !== false]),
    ...nv.meshes.flatMap((m) => [
      [m.name, m.visible !== false],
      ...m.layers.map((l) => [l.name, l.opacity > 0]),
    ]),
  ])
  expect(tree).toEqual(scene)
}

test('M1: layers, properties, reorder, visibility, mesh layers', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await ready(page)

  await drop(page, ['fslmean.nii.gz', 'z_FDR_0.01_hand.nii.gz', 'z_FDR_0.01_hand.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(3)
  await treeMatchesNv(page)

  // Select the first overlay and give it a negative colormap via the properties panel.
  await page.locator('[role=treeitem]').nth(1).click()
  await page.getByLabel('Negative').selectOption('Winter')
  await expect.poll(() => page.evaluate(() => nv.volumes[1].colormapNegative?.toLowerCase())).toBe('winter')
  await page.getByLabel('Darkest', { exact: true }).fill('2.5')
  await page.getByLabel('Darkest', { exact: true }).press('Enter')
  await expect.poll(() => page.evaluate(() => nv.volumes[1].calMin)).toBe(2.5)
  // vox.stats-style controls: colorbar range mode, interpolation, invert, outline.
  await page.getByLabel(/^Range/).selectOption('From 0, transparent below')
  await expect.poll(() => page.evaluate(() => nv.volumes[1].colormapType)).toBe(1)
  await page.getByLabel('Interpolation').selectOption('Nearest')
  await expect.poll(() => page.evaluate(() => nv.volumes[1].isNearestInterpolation)).toBe(true)
  await page.getByLabel('Invert colormap').check()
  await expect.poll(() => page.evaluate(() => nv.volumes[1].isColormapInverted)).toBe(true)
  await page.getByLabel('Outline').fill('0.5')
  await expect.poll(() => page.evaluate(() => nv.volumeOutlineWidth)).toBe(0.5)
  // Disabled, with a pointer to View ▸ Colorbar, while colorbars are hidden.
  const bar = page.locator('[data-section="props"]').getByLabel('Colorbar')
  await page.evaluate(() => {
    nv.isColorbarVisible = false
  })
  await expect(bar).toBeDisabled()
  await expect(page.locator('[data-section="props"] label.check', { hasText: 'Colorbar' })).toHaveAttribute(
    'title',
    /View ▸ Colorbar/,
  )
  await page.evaluate(() => {
    nv.isColorbarVisible = true
  })
  await expect(bar).toBeEnabled()
  await bar.uncheck()
  await expect.poll(() => page.evaluate(() => nv.volumes[1].isColorbarVisible)).toBe(false)

  // Reorder by context menu: overlay 1 down → index 2.
  await page.evaluate(() => {
    nv.volumes[2].name = 'second'
  })
  await page.locator('[role=treeitem]').nth(1).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move Down' }).click()
  await expect.poll(() => page.evaluate(() => nv.volumes.map((v) => v.name)[2])).not.toBe('second')
  await treeMatchesNv(page)

  // Reorder by drag: last overlay onto background slot.
  await page.locator('[role=treeitem]').nth(2).dragTo(page.locator('[role=treeitem]').nth(0))
  await expect.poll(() => page.evaluate(() => nv.volumes[0].name)).not.toBe('fslmean')
  await treeMatchesNv(page)

  // Visibility toggle.
  await page.locator('[role=treeitem] input').nth(1).uncheck()
  await expect.poll(() => page.evaluate(() => nv.volumes[1].visible)).toBe(false)
  await treeMatchesNv(page)

  // Mesh + per-vertex layer in one drop; the layer attaches to the new mesh.
  await drop(page, ['BrainMesh_ICBM152.lh.motor.mz3', 'BrainMesh_ICBM152.lh.mz3'])
  await expect.poll(() => page.evaluate(() => nv.meshes[0]?.layers.length)).toBe(1)
  await treeMatchesNv(page)

  // Second layer by selection, then reorder mesh layers losslessly.
  await page.locator('[role=treeitem]', { hasText: 'BrainMesh_ICBM152.lh.mz3' }).click()
  await drop(page, ['BrainMesh_ICBM152.lh.curv'])
  await expect.poll(() => page.evaluate(() => nv.meshes[0].layers.length)).toBe(2)
  await page.evaluate(() => nv.setMeshLayerProperty(0, 1, { calMin: 0.123 }))
  await page.locator('[role=treeitem]', { hasText: 'curv' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move Up' }).click()
  await expect.poll(() => page.evaluate(() => nv.meshes[0].layers[0].name)).toContain('curv')
  expect(await page.evaluate(() => nv.meshes[0].layers[0].calMin)).toBe(0.123)
  await treeMatchesNv(page)

  // Hide a mesh layer and restore its opacity.
  const row = page.locator('[role=treeitem]', { hasText: 'motor' })
  const before = await page.evaluate(() => nv.meshes[0].layers[1].opacity)
  await row.locator('input').uncheck()
  await treeMatchesNv(page)
  await row.locator('input').check()
  expect(await page.evaluate(() => nv.meshes[0].layers[1].opacity)).toBe(before)

  expect(errors).toEqual([])
})

test('M1: per-vertex drop without a target mesh is rejected', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['BrainMesh_ICBM152.lh.curv'])
  await expect(page.getByRole('status')).toContainText('Select a mesh')
  expect(await page.evaluate(() => nv.meshes.length + nv.volumes.length)).toBe(0)
})

test('M1: narrow default tools panel; rows show the full name on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.goto('./')
  await ready(page)
  const width = await page
    .locator('[data-panel][id="tools"]')
    .evaluate((e) => e.getBoundingClientRect().width)
  expect(width).toBeGreaterThan(200)
  expect(width).toBeLessThan(280) // 240px default, not a share of a wide window
  const long = 'sub-01_ses-preop_task-fingertapping_acq-mb4_run-01_desc-zstat_bold.nii.gz'
  await drop(page, [`z_FDR_0.01_hand.nii.gz>${long}`])
  await expect(page.locator('[role=treeitem]').first()).toHaveAttribute(
    'title',
    `${long} — background volume`,
  )
})

test('Undo/Redo: settings step back and forward; loading a layer starts a new history', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  const vol = () =>
    page.evaluate(() => ({ cm: nv.volumes[0].colormap?.toLowerCase(), min: nv.volumes[0].calMin }))
  const { min } = await vol()
  await page.waitForTimeout(600) // history baseline settles
  await page.locator('[role=treeitem]').first().click()
  const props = page.locator('[data-section="props"]')
  await props.getByLabel(/^Colormap/).selectOption('Hot')
  await page.waitForTimeout(600)
  await props.getByLabel('Darkest', { exact: true }).fill('50')
  await props.getByLabel('Darkest', { exact: true }).press('Enter')
  await expect.poll(vol).toEqual({ cm: 'hot', min: 50 })
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(vol).toEqual({ cm: 'hot', min })
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(vol).toEqual({ cm: 'gray', min })
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(vol).toEqual({ cm: 'hot', min })
  // Focus left on a slider (no text undo of its own): ⌘Z undoes the scene change.
  await page.waitForTimeout(600)
  await props.getByLabel('Opacity').fill('0.3')
  await expect.poll(() => page.evaluate(() => nv.volumes[0].opacity)).toBeCloseTo(0.3)
  await page.waitForTimeout(600)
  await props.getByLabel('Opacity').press('ControlOrMeta+z')
  await expect.poll(() => page.evaluate(() => nv.volumes[0].opacity)).toBeCloseTo(1)
  await drop(page, ['z_FDR_0.01_hand.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  await page.waitForTimeout(600)
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(300)
  expect((await vol()).cm).toBe('hot') // nothing to undo across the load
})

test('with nothing selected, the first layer is: its properties are editable at once', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz', 'z_FDR_0.01_hand.nii.gz'])
  await expect(page.locator('[role=treeitem]').first()).toHaveAttribute('aria-selected', 'true')
  await page
    .locator('[data-section="props"]')
    .getByLabel(/^Colormap/)
    .selectOption('Hot')
  await expect.poll(() => page.evaluate(() => nv.volumes[0].colormap?.toLowerCase())).toBe('hot')
  // Removing the selected layer selects the new first one.
  await page.locator('[role=treeitem]').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(page.locator('[role=treeitem]').first()).toHaveAttribute('aria-selected', 'true')
})

test('startup opens the MNI152 template, clean and untitled; a script link starts empty', async ({
  page,
}) => {
  await page.route('**/samples/mni152.nii.gz', (r) =>
    r.fulfill({ body: readFileSync('tests/fixtures/fslmean.nii.gz') }),
  )
  await page.addInitScript(() => {
    const k = 'niivue-pwa:prefs'
    localStorage.setItem(
      k,
      JSON.stringify({ ...JSON.parse(localStorage.getItem(k) ?? '{}'), startTemplate: true }),
    )
  })
  await page.goto('./')
  await ready(page)
  await expect.poll(() => page.evaluate(() => nv.volumes.map((v) => v.name))).toEqual(['mni152.nii.gz'])
  expect(await page.evaluate(() => doc.dirty)).toBe(false)
  await expect(page).toHaveTitle('MRIvue')
  const linked = await page.context().newPage() // default preferences: template on
  await linked.goto(`./#script=${Buffer.from('// hi').toString('base64url')}`)
  await ready(linked)
  await linked.waitForTimeout(1000)
  expect(await linked.evaluate(() => nv.volumes.length)).toBe(0)
})
