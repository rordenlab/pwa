import type { Page } from '@playwright/test'
import { drop, expect, ready, test } from './util'

const shown = (page: Page) =>
  page.$$eval('[data-section]', (els) => els.map((e) => e.getAttribute('data-section')))
const sec = (page: Page, id: string) => page.locator(`[data-section="${id}"]`)
const val = <T>(page: Page, f: () => T) => page.evaluate(f)
const menu = async (page: Page, ...path: string[]) => {
  await page.locator('.menubar-trigger', { hasText: path[0] }).click()
  for (const p of path.slice(1, -1)) await page.getByRole('menuitem', { name: p, exact: true }).hover()
  const name = path[path.length - 1]
  await page
    .getByRole('menuitem', { name, exact: true })
    .or(page.getByRole('menuitemcheckbox', { name, exact: true }))
    .click()
}

test('M4: sections follow view and data kinds', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  expect(await shown(page)).toEqual(['layers'])

  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => val(page, () => nv.volumes.length)).toBe(1)
  await menu(page, 'View', 'Axial')
  expect(await shown(page)).toEqual(['layers', 'slices', 'colorbar'])

  await menu(page, 'View', 'Multiplanar')
  expect(await shown(page)).toEqual(['layers', 'clip', 'render', 'slices', 'colorbar'])

  await menu(page, 'View', 'Render')
  expect(await shown(page)).toEqual(['layers', 'clip', 'render', 'colorbar'])

  await menu(page, 'View', 'Mosaic')
  expect(await shown(page)).toEqual(['layers', 'mosaic', 'colorbar'])

  await menu(page, 'View', 'Render')
  await page.locator('[role=treeitem]').first().click()
  await drop(page, ['BrainMesh_ICBM152.lh.mz3'])
  await drop(page, ['TR_S_R.tt.gz'])
  await drop(page, ['LPBA40.jcon'])
  await expect.poll(() => val(page, () => nv.meshes.length)).toBe(3)
  expect(await shown(page)).toEqual([
    'layers',
    'props',
    'clip',
    'render',
    'mesh',
    'tracts',
    'connectome',
    'colorbar',
  ])

  // Unpin survives reload; the strip brings it back.
  await page.getByRole('button', { name: 'Render', exact: true }).click()
  expect(await shown(page)).not.toContain('render')
  await page.reload()
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => val(page, () => nv.volumes.length)).toBe(1)
  await menu(page, 'View', 'Render')
  expect(await shown(page)).not.toContain('render')
  await page.getByRole('button', { name: 'Render', exact: true }).click()
  expect(await shown(page)).toContain('render')
})

test('M4: every control drives core state and follows script changes', async ({ page }) => {
  test.setTimeout(90_000) // ~25 s alone; many panels and loads, slower under parallel load
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => val(page, () => nv.volumes.length)).toBe(1)

  // Slices
  await menu(page, 'View', 'Axial')
  const s = sec(page, 'slices')
  await s.getByLabel('Z (mm)').fill('10')
  await s.getByLabel('Z (mm)').press('Enter')
  await expect.poll(() => s.getByLabel('Z (mm)').inputValue()).toMatch(/^1[0-2](\.\d+)?$|^[89](\.\d+)?$/)
  await s.getByLabel('Multiplanar').selectOption('GRID')
  expect(await val(page, () => nv.multiplanarType)).toBe(2)
  await s.getByLabel('Radiological').check()
  expect(await val(page, () => nv.isRadiological)).toBe(true)
  await s.getByLabel('Ruler').check()
  expect(await val(page, () => nv.isRulerVisible)).toBe(true)
  await s.getByLabel('Crosshair', { exact: true }).fill('3')
  expect(await val(page, () => nv.crosshairWidth)).toBe(3)
  // Direction buttons step the crosshair one voxel (S = +1 voxel superior).
  const z = Number(await s.getByLabel('Z (mm)').inputValue())
  await s.getByRole('button', { name: 'S', exact: true }).click()
  await expect.poll(async () => Number(await s.getByLabel('Z (mm)').inputValue())).toBeGreaterThan(z)
  const z2 = Number(await s.getByLabel('Z (mm)').inputValue())
  await page.keyboard.press('Alt+KeyI') // menu shortcut: one voxel inferior in 2D
  await expect.poll(async () => Number(await s.getByLabel('Z (mm)').inputValue())).toBeLessThan(z2)
  expect(await val(page, () => nv.sliceType)).toBe(0)

  // Mosaic
  await menu(page, 'View', 'Mosaic')
  const m = sec(page, 'mosaic')
  await m.getByLabel(/Columns/).fill('3')
  await expect.poll(() => val(page, () => nv.mosaicString.split(';')[0].trim().split(' ').length)).toBe(4)
  await m.getByLabel('String').fill('S 0 10')
  expect(await val(page, () => nv.mosaicString)).toBe('S 0 10')

  // Clip planes and render
  await menu(page, 'View', 'Render')
  const c = sec(page, 'clip')
  await c.getByLabel('Preset').selectOption('One plane')
  await expect(c.locator('fieldset')).toHaveCount(1)
  await c.getByLabel('Depth').fill('0.5')
  expect(await val(page, () => nv.getClipPlaneDepthAziElev(0)[0])).toBeCloseTo(0.5)
  await c.getByLabel(/Cutaway/).check()
  expect(await val(page, () => nv.isClipPlaneCutaway)).toBe(true)
  await c.getByLabel('Clip overlays').check()
  expect(await val(page, () => nv.clipPlaneOverlay)).toBe(true)
  await c.getByLabel('Show plane').selectOption('Shaded')
  expect(await val(page, () => nv.clipPlaneColor[3])).toBeCloseTo(-0.2)
  await c.getByRole('button', { name: 'Add plane' }).click()
  await expect(c.locator('fieldset')).toHaveCount(2)

  const r = sec(page, 'render')
  await r.getByLabel('Mode').selectOption('MIP')
  expect(await val(page, () => nv.volumeRenderMode)).toBe(1)
  await r.getByLabel('MatCap').selectOption('Cortex')
  await expect.poll(() => val(page, () => nv.volumeMatcap.length)).toBeGreaterThan(10)
  for (const [label, prop, v] of [
    ['Illumination', 'volumeIllumination', 0.5],
    ['Gradient opacity', 'volumeGradientOpacity', 0.4],
    ['Silhouette', 'volumeSilhouette', 0.3],
    ['Quality', 'volumeSampleRate', 2],
    ['Gamma', 'gamma', 1.5],
  ] as const) {
    await r.getByLabel(label).fill(String(v))
    expect(await page.evaluate((p) => (nv as unknown as Record<string, number>)[p], prop)).toBeCloseTo(v)
  }

  // Script changes show up in the panels.
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.cm-content').click()
  await page.keyboard.insertText('nv.setClipPlanes([[0.1, 0, 0], [0.2, 90, 0], [0.3, 180, 0]])\nnv.gamma = 2')
  await page.keyboard.press('Shift+Enter')
  await expect(c.locator('fieldset')).toHaveCount(3)
  await expect(r.getByLabel('Gamma')).toHaveValue('2')

  // Mesh, tracts, connectome, colorbar
  await drop(page, ['BrainMesh_ICBM152.lh.mz3'])
  await drop(page, ['TR_S_R.tt.gz'])
  await drop(page, ['LPBA40.jcon'])
  await expect.poll(() => val(page, () => nv.meshes.length)).toBe(3)
  const me = sec(page, 'mesh')
  await me.getByLabel('Shader').selectOption('toon')
  await expect.poll(() => val(page, () => nv.meshes[0].shaderType)).toBe('toon')
  await me.getByLabel('X-ray').fill('0.4')
  expect(await val(page, () => nv.meshXRay)).toBeCloseTo(0.4)
  await me.getByLabel('Opacity').fill('0.6')
  await expect.poll(() => val(page, () => nv.meshes[0].opacity)).toBeCloseTo(0.6)

  const t = sec(page, 'tracts')
  await t.getByLabel('Width').fill('1.5')
  await expect.poll(() => val(page, () => nv.meshes[1].tractOptions?.fiberRadius)).toBeCloseTo(1.5)
  await t.getByLabel('Color by').selectOption('fixed color')
  await expect.poll(() => val(page, () => nv.meshes[1].tractOptions?.colorBy)).toBe('fixed')

  const k = sec(page, 'connectome')
  await k.getByLabel('Node size').fill('5')
  await expect.poll(() => val(page, () => nv.meshes[2].connectomeOptions?.nodeScale)).toBe(5)
  await k.getByLabel('Edge colors').selectOption('Hot')
  await expect
    .poll(() => val(page, () => nv.meshes[2].connectomeOptions?.edgeColormap.toLowerCase()))
    .toBe('hot')

  const cb = sec(page, 'colorbar')
  const before = await val(page, () => nv.isColorbarVisible)
  await cb.getByLabel('Colorbar').click()
  expect(await val(page, () => nv.isColorbarVisible)).toBe(!before)
  expect(errors).toEqual([])
})

test('M4: section icons show tooltips', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await page.getByRole('button', { name: 'Clip planes', exact: true }).hover()
  await expect(page.getByRole('tooltip')).toContainText('Clip planes')
  await expect(page.getByRole('tooltip')).toContainText('Not used in this view')
  await page.locator('.sections').hover({ position: { x: 100, y: 200 } })
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.getByRole('button', { name: 'Layers', exact: true }).hover()
  await expect(page.getByRole('tooltip')).toContainText('Click to hide')
})

test('M4: MatCap "(none)" and Illumination stay in step', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await page.locator('.menubar-trigger', { hasText: 'View' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Render', exact: true }).click()
  const r = page.locator('[data-section="render"]')
  const light = r.getByLabel('Illumination')
  const illum = () => page.evaluate(() => nv.volumeIllumination)

  await expect(r.getByLabel('MatCap')).toHaveValue('') // default: no lighting
  await expect(light).toBeDisabled()
  await r.getByLabel('MatCap').selectOption('Cortex')
  await expect.poll(illum).toBeCloseTo(0.2) // turning on from none starts at 0.2
  await expect(light).toBeEnabled()
  await expect(light).toHaveAttribute('min', '0.05') // off only via "(none)"
  await light.fill('0.7')
  await r.getByLabel('MatCap').selectOption('')
  await expect.poll(illum).toBe(0)
  await expect(light).toBeDisabled()
  await r.getByLabel('MatCap').selectOption('Shiny')
  await expect.poll(illum).toBeCloseTo(0.7) // restores the last strength
  await page.evaluate(() => {
    nv.volumeIllumination = 0 // a script turning lighting off shows "(none)"
  })
  await expect(r.getByLabel('MatCap')).toHaveValue('')
})

test('M4: section icons show shown / hidden / not-used states', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  const icon = (name: string) => page.getByRole('button', { name, exact: true })
  await expect(icon('Layers')).toHaveAttribute('data-state', 'shown')
  await expect(icon('Clip planes')).toHaveAttribute('data-state', 'unused')
  await expect(icon('Clip planes')).toHaveAttribute('aria-disabled', 'true')
  await icon('Clip planes').click({ force: true }) // inert: does not unpin
  await expect(icon('Clip planes')).toHaveAttribute('aria-pressed', 'true')
  await icon('Layers').click()
  await expect(icon('Layers')).toHaveAttribute('data-state', 'hidden')
  const colors = await page.evaluate(() =>
    ['Layers', 'Clip planes', 'Colorbar'].map(
      (n) => getComputedStyle(document.querySelector(`[aria-label="${n}"]`) as Element).color,
    ),
  )
  expect(new Set(colors).size).toBeGreaterThan(1) // hidden and unused look different
  await icon('Layers').click()
  await expect(icon('Layers')).toHaveAttribute('data-state', 'shown')
})

test('M4: Mesh layers section edits both sides of a painted overlay', async ({ page }) => {
  test.setTimeout(90_000) // loads and projects the template's mesh and volume
  await page.goto('./')
  await ready(page)
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await page.locator('.menubar-trigger', { hasText: 'Script' }).click()
  await page.getByRole('menuitem', { name: 'Templates', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'basic_paint_surface', exact: true }).click() // runs it
  await expect(page.locator('.output')).toContainText('Done', { timeout: 30_000 })
  const s = sec(page, 'meshlayers')
  await expect(s.getByLabel('Layer')).toHaveValue('0:0')
  const layer = () => page.evaluate(() => nv.meshes[0].layers[0])
  await s.getByLabel('Darkest', { exact: true }).fill('3')
  await s.getByLabel('Darkest', { exact: true }).press('Enter')
  await expect.poll(async () => (await layer()).calMin).toBe(3)
  await expect(s.getByLabel('Neg. darkest')).toHaveValue('-1')
  await s.getByLabel('Neg. darkest').fill('-1.5')
  await s.getByLabel('Neg. darkest').press('Enter')
  await expect.poll(async () => (await layer()).calMinNeg).toBe(-1.5)
  await s.getByLabel('Negative').selectOption('')
  await expect(s.getByLabel('Neg. darkest')).toHaveCount(0)
  await s.getByLabel('Colormap').selectOption('Hot')
  await expect.poll(async () => (await layer()).colormap.toLowerCase()).toBe('hot')
  // The tree and the picker stay in sync; Layer properties does not duplicate these controls.
  await page.locator('[role=treeitem]', { hasText: 'motor_4t95vol' }).click()
  await expect(page.locator('[data-section="props"]')).toHaveCount(0)
  await expect(s.getByLabel('Layer')).toHaveValue('0:0')
})
