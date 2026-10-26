import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { drop, expect, ready, test } from './util'

// Real FileSystemFileHandles from OPFS stand in for native pickers: they persist in
// IndexedDB and support createWritable, so save-in-place and Recent are exercised for real.
async function mockPickers(page: Page, open: string[]) {
  const files = open.map((n) => ({ n, b: readFileSync(`tests/fixtures/${n}`).toString('base64') }))
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory()
    const handles: FileSystemFileHandle[] = []
    for (const { n, b } of files) {
      const h = await root.getFileHandle(n, { create: true })
      const w = await h.createWritable()
      await w.write(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)))
      await w.close()
      handles.push(h)
    }
    const g = window as unknown as Record<string, unknown>
    g.showOpenFilePicker = async () => handles
    g.showSaveFilePicker = async (o: { suggestedName: string }) =>
      root.getFileHandle(o.suggestedName, { create: true })
  }, files)
}

const item = (page: Page, name: string) =>
  page
    .getByRole('menuitem', { name, exact: true })
    .or(page.getByRole('menuitemcheckbox', { name, exact: true }))
const menu = async (page: Page, ...path: string[]) => {
  await page.locator('.menubar-trigger', { hasText: path[0] }).click()
  for (const p of path.slice(1, -1)) await item(page, p).hover()
  await item(page, path[path.length - 1]).click()
}
const title = (page: Page) => page.locator('.status')
const opfsSize = (page: Page, name: string) =>
  page.evaluate(
    async (n) => (await (await (await navigator.storage.getDirectory()).getFileHandle(n)).getFile()).size,
    name,
  )

test('M2: open, dirty state, save in place, recent after restart, menus', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await ready(page)
  await mockPickers(page, ['fslmean.nii.gz'])

  await menu(page, 'File', 'Open…')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(true)

  // Camera moves do not dirty; save clears it.
  await menu(page, 'File', 'Save Document As…')
  await expect(title(page)).toContainText('Saved untitled.nvd')
  await page.evaluate(() => {
    nv.azimuth = 33
  })
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(false)
  const firstSize = await opfsSize(page, 'untitled.nvd')
  expect(firstSize).toBeGreaterThan(1000)

  // A layer change dirties; ⌘S writes in place to the same handle.
  await drop(page, ['z_FDR_0.01_hand.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  // Edited properties and voxel data must be what gets saved, not the source file.
  const edited = await page.evaluate(async () => {
    await nv.setVolume(1, { colormapNegative: 'winter', calMin: 2.5, visible: false })
    const v = nv.volumes[1]
    const i = Math.floor((v.img as ArrayLike<number>).length / 2)
    ;(v.img as unknown as number[])[i] = 1234
    ;(v as unknown as { isDirty: boolean }).isDirty = true
    await nv.setVolume(1, {})
    return { i, value: (v.img as ArrayLike<number>)[i] }
  })
  await page.keyboard.press('ControlOrMeta+KeyS')
  await expect.poll(() => opfsSize(page, 'untitled.nvd')).toBeGreaterThan(firstSize)

  // View menu drives core state.
  await menu(page, 'View', 'Render')
  expect(await page.evaluate(() => nv.sliceType)).toBe(4)
  await page.keyboard.press('Alt+KeyL')
  expect(await page.evaluate(() => nv.azimuth)).toBe(90)
  await menu(page, 'View', 'Mosaic')
  expect(await page.evaluate(() => nv.mosaicString)).not.toBe('')

  // Restart: Recent survives (handles in IndexedDB) and reopens the document.
  await page.reload()
  await ready(page)
  await menu(page, 'File', 'Open Recent', 'fslmean.nii.gz')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)

  // Reopen the saved document: both volumes come back.
  await mockPickers(page, [])
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const h = await root.getFileHandle('untitled.nvd')
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [h]
  })
  page.once('dialog', (d) => d.accept())
  await menu(page, 'File', 'Open…')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  await expect(page).toHaveTitle(/^MRIvue: untitled/)
  const back = await page.evaluate((i) => {
    const v = nv.volumes[1]
    return {
      neg: v.colormapNegative?.toLowerCase(),
      calMin: v.calMin,
      visible: v.visible,
      value: (v.img as ArrayLike<number>)[i],
    }
  }, edited.i)
  expect(back).toEqual({ neg: 'winter', calMin: 2.5, visible: false, value: edited.value })

  // Same-origin sample from the grouped catalog.
  await menu(page, 'File', 'Open Sample', 'Atlases', 'aal.nii.gz')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(3)
  expect(errors).toEqual([])
})

test('M2: without File System Access, saving downloads', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    delete w.showOpenFilePicker
    delete w.showSaveFilePicker
  })
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  const download = page.waitForEvent('download')
  await page.keyboard.press('ControlOrMeta+KeyS')
  expect((await download).suggestedFilename()).toBe('untitled.nvd')
  const vol = page.waitForEvent('download')
  await menu(page, 'File', 'Save Volume…')
  expect((await vol).suggestedFilename()).toBe('fslmean.nii.gz')
})

test('M2: cancelled or failed saves keep the scene dirty; denied Recent leaves the scene alone', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  await mockPickers(page, ['fslmean.nii.gz'])
  await menu(page, 'File', 'Open…')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)

  // Cancel the save picker.
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () => {
      throw new DOMException('cancelled', 'AbortError')
    }
  })
  await page.keyboard.press('ControlOrMeta+KeyS')
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(true)
  await expect(page.locator('.status')).not.toContainText('Saved')

  // The write fails.
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () => ({
      name: 'x.nvd',
      createWritable: async () => {
        throw new DOMException('disk full', 'QuotaExceededError')
      },
    })
  })
  await page.keyboard.press('ControlOrMeta+KeyS')
  await expect(page.locator('.status')).toContainText('Save failed: disk full')
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(true)

  // Recent entry whose permission is denied: message, scene unchanged.
  await page.evaluate(() => {
    const proto = FileSystemHandle.prototype as unknown as Record<string, unknown>
    proto.queryPermission = async () => 'prompt'
    proto.requestPermission = async () => 'denied'
  })
  await menu(page, 'File', 'Open Recent', 'fslmean.nii.gz')
  await expect(page.locator('.status')).toContainText('Permission to read fslmean.nii.gz was not granted')
  expect(await page.evaluate(() => nv.volumes.length)).toBe(1)
})

test('M2: audit regressions (rename dirty, script open keeps scene, bad .nvd rollback, Save As in Recent)', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  await mockPickers(page, ['fslmean.nii.gz'])
  await menu(page, 'File', 'Open…')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await menu(page, 'File', 'Save Document As…')
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(false)
  await menu(page, 'File', 'Open Recent', 'untitled.nvd') // Save As is remembered
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(false)

  // Rename has no core event but must mark the scene changed.
  await page.locator('[role=treeitem]').first().dblclick()
  await page.keyboard.insertText('renamed')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(true)

  // Opening a script does not clear the scene.
  await page.evaluate(async () => {
    // Real OPFS handle: Recent stores handles in IndexedDB, which rejects fake objects.
    const h = await (await navigator.storage.getDirectory()).getFileHandle('a.js', { create: true })
    const w = await h.createWritable()
    await w.write('console.log(1)')
    await w.close()
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [h]
  })
  await menu(page, 'File', 'Open…')
  await expect(page.locator('.cm-content')).toContainText('console.log(1)')
  expect(await page.evaluate(() => nv.volumes.length)).toBe(1)

  // A malformed .nvd restores the previous scene and keeps it unsaved.
  await page.evaluate(async () => {
    // Real OPFS handle: Recent stores handles in IndexedDB, which rejects fake objects.
    const h = await (await navigator.storage.getDirectory()).getFileHandle('bad.nvd', { create: true })
    const w = await h.createWritable()
    await w.write('not a document')
    await w.close()
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [h]
  })
  page.once('dialog', (d) => d.accept())
  await menu(page, 'File', 'Open…')
  await expect(page.locator('.status')).toContainText('Could not open bad.nvd')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await expect.poll(() => page.evaluate(() => doc.dirty)).toBe(true)
})

test('M2: audit round 2 (bad volume rollback keeps name/handle, reorder keeps selection, theme keeps radiological)', async ({
  page,
}) => {
  await page.goto('./')
  await ready(page)
  await mockPickers(page, ['fslmean.nii.gz', 'z_FDR_0.01_hand.nii.gz'])
  await menu(page, 'File', 'Open…')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  await menu(page, 'File', 'Save Document As…')
  await expect(page).toHaveTitle('MRIvue: untitled')

  // Reorder by context menu, then edit: the moved layer is still the one edited.
  await page.locator('[role=treeitem]').nth(1).click()
  const moved = await page.evaluate(() => nv.volumes[1].name)
  await page.locator('[role=treeitem]').nth(1).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move Up' }).click()
  await page.getByLabel('Darkest', { exact: true }).fill('3.25')
  await page.getByLabel('Darkest', { exact: true }).press('Enter')
  await expect
    .poll(() => page.evaluate((n) => nv.volumes.find((v) => v.name === n)?.calMin, moved))
    .toBe(3.25)

  // A corrupt volume replacing the scene rolls back, keeping the document name and save handle.
  await page.evaluate(async () => {
    const h = await (await navigator.storage.getDirectory()).getFileHandle('broken.nii.gz', { create: true })
    const w = await h.createWritable()
    await w.write(new Uint8Array([0x1f, 0x8b, 1, 2, 3]))
    await w.close()
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [h]
  })
  page.once('dialog', (d) => d.accept())
  await menu(page, 'File', 'Open…')
  await expect(page.locator('.status')).toContainText('broken.nii.gz')
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  await expect(page).toHaveTitle(/^MRIvue: untitled/)

  // Changing the theme does not reset a radiological view chosen from the View menu.
  await menu(page, 'View', 'Radiological')
  expect(await page.evaluate(() => nv.isRadiological)).toBe(true)
  await page.keyboard.press('ControlOrMeta+Comma')
  await page.getByRole('dialog').getByLabel('Theme').selectOption('Dark')
  expect(await page.evaluate(() => nv.isRadiological)).toBe(true)
})

test('M2: audit round 3 (volume export follows the chosen volume)', async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await drop(page, ['fslmean.nii.gz', 'z_FDR_0.01_hand.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  // The save picker waits until the test releases it, so the scene can change meanwhile.
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    w.showSaveFilePicker = (o: { suggestedName: string }) =>
      new Promise((resolve) => {
        w.releasePicker = async () =>
          resolve(
            await (await navigator.storage.getDirectory()).getFileHandle(o.suggestedName, { create: true }),
          )
      })
  })
  const written = (name: string) =>
    page.evaluate(async (n) => {
      try {
        const f = await (await (await navigator.storage.getDirectory()).getFileHandle(n)).getFile()
        return (await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
          .byteLength
      } catch {
        return -1 // still being written (or not yet created): poll again
      }
    }, name)
  const exportLength = (name: string) =>
    page.evaluate(
      async (n) =>
        ((await nv.saveVolume({ volumeByIndex: nv.volumes.findIndex((v) => v.name === n) })) as Uint8Array)
          .length,
      name,
    )

  // Reorder while the picker is open: the chosen volume (hand) is still the one written.
  await page.locator('[role=treeitem]').nth(1).click()
  await menu(page, 'File', 'Save Volume…')
  await page.evaluate(() => nv.moveVolumeUp(0))
  await page.evaluate(() => (window as unknown as { releasePicker: () => void }).releasePicker())
  await expect
    .poll(() => written('z_FDR_0.01_hand.nii.gz'))
    .toBe(await exportLength('z_FDR_0.01_hand.nii.gz'))

  // Remove it while the picker is open: nothing else is written under its name.
  await page.locator('[role=treeitem]', { hasText: 'hand' }).click()
  await menu(page, 'File', 'Save Volume…')
  await page.evaluate(() => nv.removeVolume(nv.volumes.findIndex((v) => v.name.includes('hand'))))
  await page.evaluate(() => (window as unknown as { releasePicker: () => void }).releasePicker())
  await expect(page.locator('.status')).toContainText('was removed before it could be saved')
})
