import { drop, expect, ready, test } from './util'

test('M0: drop shows a volume; side panes collapse and restore', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)

  const tools = page.locator('[data-panel][id="tools"]')
  const width = () => tools.evaluate((e) => e.getBoundingClientRect().width)
  expect(await width()).toBeGreaterThan(100)
  await page.keyboard.press('ControlOrMeta+KeyB')
  await expect.poll(width).toBeLessThan(2)
  await page.keyboard.press('ControlOrMeta+KeyB')
  await expect.poll(width).toBeGreaterThan(100)

  const script = page.locator('[data-panel][id="script"]')
  const sw = () => script.evaluate((e) => e.getBoundingClientRect().width)
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await expect.poll(sw).toBeGreaterThan(100)
  await page.keyboard.press('ControlOrMeta+KeyJ')
  await expect.poll(sw).toBeLessThan(2)
  // Double-clicking a splitter toggles its side pane.
  await page.locator('[data-separator]').first().dblclick()
  await expect.poll(width).toBeLessThan(2)
  await page.locator('[data-separator]').first().dblclick()
  await expect.poll(width).toBeGreaterThan(100)
  expect(errors).toEqual([])
})
