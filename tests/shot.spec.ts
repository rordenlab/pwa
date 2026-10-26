import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { ready } from './util'

// Manual visual check: SHOTS=basic,node SHOT_DIR=... npx playwright test tests/shot.spec.ts
const OUT = process.env.SHOT_DIR ?? 'test-results'
const DEMO = process.env.DEMO_IMAGES ?? '../niivue-demo-images' // a clone next to this repo
for (const name of (process.env.SHOTS ?? '').split(',').filter(Boolean)) {
  test(`shot ${name}`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1100, height: 700 })
    await page.route(/cdn\.jsdelivr\.net\/gh\/niivue\/niivue-demo-images@[0-9a-f]{40}\/(.*)$/, (route) => {
      const path = new URL(route.request().url()).pathname.split(/@[0-9a-f]{40}\//)[1]
      route.fulfill({ body: readFileSync(`${DEMO}/${path}`) })
    })
    await page.goto('./')
    await ready(page)
    await page.keyboard.press('ControlOrMeta+KeyJ')
    await page.locator('.menubar-trigger', { hasText: 'Script' }).click()
    await page.getByRole('menuitem', { name: 'Templates', exact: true }).hover()
    await page.getByRole('menuitem', { name, exact: true }).click() // runs it
    await expect(page.locator('.output')).toContainText(/Done|Error|Stopped/, { timeout: 45_000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${name}.png` })
  })
}
