import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { drop, expect, ready, test } from './util'

const menu = async (page: Page, top: string, name: string) => {
  await page.locator('.menubar-trigger', { hasText: top }).click()
  await page
    .getByRole('menuitem', { name, exact: true })
    .or(page.getByRole('menuitemcheckbox', { name, exact: true }))
    .click()
}

test('M5: preferences persist and apply (theme, startup view, radiological)', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await page.keyboard.press('ControlOrMeta+Comma')
  const d = page.getByRole('dialog')
  await expect(d).toContainText('Preferences')
  await d.getByLabel('Theme').selectOption('Dark')
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  await d.getByLabel('Startup view').selectOption('Render')
  await d.getByLabel('Radiological convention').check()
  expect(await page.evaluate(() => nv.isRadiological)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(d).toHaveCount(0)

  await page.reload()
  await ready(page)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  expect(await page.evaluate(() => nv.isRadiological)).toBe(true)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.sliceType)).toBe(4)
  // Follow system again.
  await page.keyboard.press('ControlOrMeta+Comma')
  await page.getByRole('dialog').getByLabel('Theme').selectOption('Follow system')
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined()
})

test('M5: screenshot honors bitmap zoom; About shows versions', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.showOpenFilePicker
    delete w.showSaveFilePicker
  })
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  const size = async () => {
    const dl = page.waitForEvent('download')
    await menu(page, 'File', 'Save Screenshot…')
    const buf = await (await dl).createReadStream()
    const chunks: Buffer[] = []
    for await (const c of buf) chunks.push(c as Buffer)
    const png = Buffer.concat(chunks)
    return [png.readUInt32BE(16), png.readUInt32BE(20)]
  }
  const [w1] = await size()
  await page.keyboard.press('ControlOrMeta+Comma')
  await page
    .getByRole('dialog')
    .getByLabel(/Bitmap zoom/)
    .fill('2')
  await page.keyboard.press('Escape')
  const [w2] = await size()
  expect(w2).toBeGreaterThanOrEqual(w1 * 2 - 2)
  // The canvas returns to display resolution afterwards.
  expect(await page.evaluate(() => nv.devicePixelRatio)).toBe(1) // test browser: 1 CSS px = 1 device px

  await menu(page, 'Help', 'About MRIvue')
  await expect(page.getByRole('dialog')).toContainText('1.0.0-rc.37')
  await expect(page.getByRole('dialog')).toContainText('WebGL2')
})

test('M5: keyboard reaches menus, layers and dialogs', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz', 'z_FDR_0.01_hand.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  // Menubar: focus the first trigger, arrow to View, open, pick Render with Enter.
  await page.locator('.menubar-trigger').first().focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  // Layer tree: select, arrow down, F2 rename.
  await page.locator('[role=treeitem]').first().click()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[role=treeitem]').nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[role=treeitem]').nth(1)).toBeFocused() // focus follows selection
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[role=treeitem]').nth(1)).toBeFocused()
  await page.keyboard.press('F2')
  await expect(page.locator('.rename')).toBeFocused()
  await page.keyboard.insertText('renamed')
  await page.keyboard.press('Enter')
  await expect(page.locator('[role=treeitem]').nth(1)).toContainText('renamed')
  // Dialog traps focus and Escape returns.
  await page.keyboard.press('ControlOrMeta+Comma')
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
  await page.keyboard.press('Escape')
})

test('M5: no serious accessibility violations', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await page.locator('[role=treeitem]').first().click()
  await page.keyboard.press('ControlOrMeta+KeyJ')
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const r = await new AxeBuilder({ page }).exclude('canvas').analyze()
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(
      bad.map((v) => `${colorScheme} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([])
  }
})

test('M5: scripting reference lists the nv API and inserts names', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await menu(page, 'Help', 'Scripting Reference')
  const d = page.getByRole('dialog')
  await d.getByLabel('Filter reference').fill('setClipPlanes')
  await expect(d.locator('code').first()).toContainText('nv.setClipPlanes(depthAziElevs: number[][]): void')
  await d.locator('button.link').first().click()
  await expect(page.locator('.cm-content')).toContainText('nv.setClipPlanes')
  await page.screenshot({ path: 'test-results/reference.png' })
})

test('M5: root menu returns to normal after choosing an item', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await menu(page, 'View', 'Multiplanar')
  const view = page.locator('.menubar-trigger', { hasText: 'View' })
  await expect(view).toHaveAttribute('data-state', 'closed')
  expect(await view.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
})

test('M5: window title is the app name until a scene is opened or saved', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await expect(page).toHaveTitle('MRIvue')
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(true)
  await expect(page).toHaveTitle('MRIvue') // unnamed scene: no file name, even with changes
})

test('M5: View ▸ Quality sets antialiasing and resolution, keeps the scene, and persists', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  const quality = async (name: string) => {
    await page.locator('.menubar-trigger', { hasText: 'View' }).click()
    await page.getByRole('menuitem', { name: 'Quality', exact: true }).hover()
    await page.getByRole('menuitemcheckbox', { name, exact: true }).click()
  }
  expect(await page.evaluate(() => nv.isAntiAlias)).toBe(true) // default on
  await quality('Antialiasing (MSAA)')
  await expect.poll(() => page.evaluate(() => nv.isAntiAlias)).toBe(false)
  await quality('Standard (1×)')
  await expect.poll(() => page.evaluate(() => nv.devicePixelRatio)).toBe(1)
  expect(await page.evaluate(() => nv.volumes.length)).toBe(1) // the GL view was rebuilt, not the scene
  await page.reload()
  await ready(page)
  expect(await page.evaluate(() => nv.isAntiAlias)).toBe(false)
  await page.keyboard.press('ControlOrMeta+Comma')
  await expect(page.getByRole('dialog').getByLabel('Resolution')).toHaveValue('Standard (1×)')
})

test('M5: phones get one ☰ menu and start with the scene only', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('./')
  await ready(page)
  await expect(page.locator('.menubar-trigger')).toHaveCount(1)
  const width = (id: string) =>
    page.locator(`[data-panel][id="${id}"]`).evaluate((e) => e.getBoundingClientRect().width)
  await expect.poll(() => width('tools')).toBeLessThan(2)
  await page.getByRole('menuitem', { name: 'Menu' }).click()
  await page.getByRole('menuitem', { name: 'View', exact: true }).hover()
  await page.getByRole('menuitem', { name: 'Toggle Tools', exact: true }).click()
  await expect.poll(() => width('tools')).toBeGreaterThan(100)
})

test('M5: Help ▸ Copy Prompt for AI copies the brief plus the current scene', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await menu(page, 'Help', 'Copy Prompt for AI')
  await expect(page.locator('.status')).toContainText('AI prompt copied')
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('# MRIvue scripting brief for AI assistants')
  expect(text).toContain('`spm152.nii.gz` (Volumes)')
  expect(text).toContain('volume 0 (background): fslmean.nii.gz')
  expect(text).toContain('## Request')
})

test('M5: File ▸ Install as App uses the browser prompt, or explains how', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  // No prompt from the browser (Safari/Firefox, or not yet installable): instructions.
  await menu(page, 'File', 'Install as App…')
  await expect(page.getByRole('dialog')).toContainText('own window, works offline')
  await page.keyboard.press('Escape')
  // Chromium's prompt (simulated: real installability needs engagement heuristics).
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<unknown>
    }
    e.prompt = async () => {
      ;(window as unknown as { prompted: boolean }).prompted = true
    }
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(e)
  })
  await menu(page, 'File', 'Install as App…')
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted))
    .toBe(true)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
