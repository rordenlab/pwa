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
