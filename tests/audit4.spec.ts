import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { drop, expect, ready, test } from './util'

// Audit round 4: operations racing a busy scene queue. A script load from a slow URL holds the
// queue; everything issued meanwhile must apply to the scene as it is when its turn comes.

async function holdQueue(page: Page, ms = 1500) {
  const bytes = readFileSync('tests/fixtures/fslmean.nii.gz')
  await page.route('**/slow/hold.nii.gz', async (route) => {
    await new Promise((r) => setTimeout(r, ms))
    await route.fulfill({ body: bytes })
  })
  await page.evaluate(() => {
    const v = document.querySelector('.cm-content')
    if (!v) throw new Error('editor missing')
  })
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+KeyA')
  await page.keyboard.insertText("await nv.addVolume({ url: location.origin + '/pwa/slow/hold.nii.gz' })")
  await page.keyboard.press('Shift+Enter')
  await page.waitForTimeout(200)
}

const runScript = async (page: Page, code: string) => {
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+KeyA')
  await page.keyboard.insertText(code)
  await page.keyboard.press('Shift+Enter')
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await ready(page)
  await page.keyboard.press('ControlOrMeta+KeyJ')
})

test('save issued while another document is opening never writes into the previous file', async ({
  page,
}) => {
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  // Save as A.nvd (real OPFS file), and keep B.nvd ready to open.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const w = window as unknown as Record<string, unknown>
    w.showSaveFilePicker = async (o: { suggestedName: string }) =>
      root.getFileHandle(o.suggestedName === 'untitled.nvd' ? 'A.nvd' : o.suggestedName, { create: true })
    const b = await root.getFileHandle('B.nvd', { create: true })
    const wr = await b.createWritable()
    await wr.write(new Uint8Array(0)) // empty scene document is written below
    await wr.close()
  })
  await page.keyboard.press('ControlOrMeta+Shift+KeyS')
  await expect(page.locator('.status')).toContainText('Saved A.nvd')
  const sizeA = () =>
    page.evaluate(
      async () =>
        (await (await (await navigator.storage.getDirectory()).getFileHandle('A.nvd')).getFile()).size,
    )
  const before = await sizeA()
  // B: a document with no volumes.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const b = await root.getFileHandle('B.nvd')
    const wr = await b.createWritable()
    const empty = new (Object.getPrototypeOf(nv).constructor)()
    await wr.write(empty.serializeDocument())
    await wr.close()
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [b]
  })
  await holdQueue(page)
  page.on('dialog', (d) => d.accept())
  await page.locator('.menubar-trigger', { hasText: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Open…', exact: true }).click() // queued behind the hold
  await page.keyboard.press('ControlOrMeta+KeyS') // queued behind the open
  await expect(page).toHaveTitle(/MRIvue: B/)
  await expect(page.locator('.status')).toContainText(/Save failed: another document was opened|Saved/)
  // A.nvd holds a complete scene (whether the save ran just before or was refused after the open),
  // never the half-cleared scene of a document mid-load.
  expect(await sizeA()).toBeGreaterThanOrEqual(before)
  const volumesInA = await page.evaluate(async () => {
    const f = await (await (await navigator.storage.getDirectory()).getFileHandle('A.nvd')).getFile()
    const probe = new (Object.getPrototypeOf(nv).constructor)()
    await probe.loadDocument(f)
    return probe.volumes.length
  })
  expect(volumesInA).toBeGreaterThan(0)
})

test('overlapping script saves land in request order', async ({ page }) => {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const real = await root.getFileHandle('s.js', { create: true })
    const w = window as unknown as Record<string, unknown>
    let first = true
    // The first write waits until released; later writes go straight through.
    w.showSaveFilePicker = async () => ({
      kind: 'file',
      name: 's.js',
      createWritable: async () => {
        if (first) {
          first = false
          await new Promise((r) => {
            w.releaseWrite = r
          })
        }
        return real.createWritable()
      },
    })
  })
  const menu = async (name: string) => {
    await page.locator('.menubar-trigger', { hasText: 'Script' }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  await runScript(page, "'old'")
  await menu('Save As…') // blocked in the first write
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+KeyA')
  await page.keyboard.insertText("'new'")
  await menu('Save As…') // queued behind it
  await page.evaluate(() => (window as unknown as { releaseWrite: () => void }).releaseWrite())
  // A file with an open write stream cannot be read (NotReadableError): report null and let poll retry.
  const disk = () =>
    page.evaluate(async () =>
      (await (await (await navigator.storage.getDirectory()).getFileHandle('s.js')).getFile())
        .text()
        .catch(() => null),
    )
  await expect.poll(disk).toBe("'new'")
  await expect(page.locator('.script-name')).not.toContainText('•')
})

test('a queued mesh layer never attaches to a different mesh', async ({ page }) => {
  await drop(page, ['BrainMesh_ICBM152.lh.mz3>A.mz3'])
  await drop(page, ['BrainMesh_ICBM152.lh.mz3>B.mz3'])
  await expect.poll(() => page.evaluate(() => nv.meshes.length)).toBe(2)
  await page.locator('[role=treeitem]', { hasText: 'A.mz3' }).click()
  await holdQueue(page)
  await drop(page, ['BrainMesh_ICBM152.lh.curv']) // targets A, queued
  await page.evaluate(() => nv.removeMesh(0)) // A goes away while it waits
  await expect(page.locator('.status')).toContainText('was removed', { timeout: 10_000 })
  expect(await page.evaluate(() => nv.meshes.map((m) => `${m.name}:${m.layers.length}`))).toEqual(['B.mz3:0'])
})

test('removing one of two same-name layers keeps the survivor as the source', async ({ page }) => {
  await drop(page, ['fslmean.nii.gz>scan.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await drop(page, ['z_FDR_0.01_hand.nii.gz>scan.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(2)
  await page.evaluate(() => nv.removeVolume(1)) // remove B (hand)
  await runScript(
    page,
    "await nv.addVolume({ url: 'scan' })\nconsole.log('dims', nv.volumes[1].dims.join('x'))",
  )
  await expect(page.locator('.output')).toContainText('dims 3x64x64x36') // A (fslmean)
})

test('round 5: a script mesh layer queued behind other work never attaches to a different mesh', async ({
  page,
}) => {
  await drop(page, ['BrainMesh_ICBM152.lh.mz3>A.mz3'])
  await drop(page, ['BrainMesh_ICBM152.lh.mz3>B.mz3'])
  await expect.poll(() => page.evaluate(() => nv.meshes.length)).toBe(2)
  const bytes = readFileSync('tests/fixtures/fslmean.nii.gz')
  await page.route('**/slow/hold.nii.gz', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.fulfill({ body: bytes })
  })
  const curv = readFileSync('tests/fixtures/BrainMesh_ICBM152.lh.curv').toString('base64')
  await page.evaluate((b) => {
    ;(window as unknown as { curv: File }).curv = new File(
      [Uint8Array.from(atob(b), (c) => c.charCodeAt(0))],
      'A.curv',
    )
  }, curv)
  // One script: a slow load holds the queue, the layer for mesh 0 (A) queues behind it,
  // and A is removed while it waits.
  await runScript(
    page,
    [
      "const hold = nv.addVolume({ url: location.origin + '/pwa/slow/hold.nii.gz' })",
      'const layer = nv.addMeshLayer(0, { url: window.curv })',
      'await nv.removeMesh(0)',
      'await Promise.all([hold, layer])',
    ].join('\n'),
  )
  await expect(page.locator('.output .error')).toContainText('A.mz3 was removed')
  expect(await page.evaluate(() => nv.meshes.map((m) => `${m.name}:${m.layers.length}`))).toEqual(['B.mz3:0'])
})

test('round 5: a failed open restores sources, sidecars and hidden-layer opacity with the scene', async ({
  page,
}) => {
  await drop(page, ['fslmean.nii.gz>custom_scan.nii.gz'])
  await drop(page, ['BrainMesh_ICBM152.lh.mz3', 'BrainMesh_ICBM152.lh.curv'])
  await expect.poll(() => page.evaluate(() => nv.meshes[0]?.layers.length)).toBe(1)
  // Hide the mesh layer (opacity remembered by the app), then fail an open.
  const layerRow = page.locator('[role=treeitem]', { hasText: 'curv' })
  const opacity = await page.evaluate(() => nv.meshes[0].layers[0].opacity)
  await layerRow.locator('input').uncheck()
  page.once('dialog', (d) => d.accept()) // discard prompt for the unsaved scene
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['not a document'], 'bad.nvd'))
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true }))
  })
  await expect(page.locator('.status')).toContainText('Could not open bad.nvd')
  await expect.poll(() => page.evaluate(() => nv.volumes.length + nv.meshes.length)).toBe(2)
  // The restored volume still resolves by name.
  await runScript(page, "await nv.addVolume({ url: 'custom_scan' })\nconsole.log('n', nv.volumes.length)")
  await expect(page.locator('.output')).toContainText('n 2')
  // The restored hidden layer shows again at its previous opacity.
  await page.locator('[role=treeitem]', { hasText: 'curv' }).locator('input').check()
  await expect.poll(() => page.evaluate(() => nv.meshes[0].layers[0].opacity)).toBe(opacity)
})

test('sweep: rename field and selection stay with their layer when the list changes', async ({ page }) => {
  await drop(page, [
    'fslmean.nii.gz>a.nii.gz',
    'z_FDR_0.01_hand.nii.gz>b.nii.gz',
    'z_FDR_0.01_hand.nii.gz>c.nii.gz',
  ])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(3)
  // Select b and open its rename field, then a script-like removal of a shifts everything up.
  const b = page.locator('[role=treeitem]', { hasText: 'b.nii.gz' })
  await b.click()
  await b.dblclick()
  await page.evaluate(() => nv.removeVolume(0))
  await page.keyboard.insertText('renamed-b')
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => nv.volumes.map((v) => v.name))).toEqual(['renamed-b', 'c.nii.gz'])
  // The selection followed b to its new position; edits still go to b.
  await page.getByLabel('Darkest', { exact: true }).fill('2.75')
  await page.getByLabel('Darkest', { exact: true }).press('Enter')
  await expect.poll(() => page.evaluate(() => nv.volumes[0].calMin)).toBe(2.75)
  expect(await page.evaluate(() => nv.volumes[1].calMin)).not.toBe(2.75)
})

test('sweep: a running script stops when the user opens another scene', async ({ page }) => {
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await runScript(page, "while (true) { await nv.setVolume(0, { colormap: 'hot' }); await nv.wait(50) }")
  await page.waitForTimeout(300)
  page.once('dialog', (d) => d.accept())
  await page.locator('.menubar-trigger', { hasText: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Close All', exact: true }).click()
  await expect(page.locator('.output .error')).toContainText('another scene was opened')
  await drop(page, ['z_FDR_0.01_hand.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => nv.volumes[0].colormap?.toLowerCase())).not.toBe('hot')
})

test('round 6: script assignments after a plain await stop when the scene was replaced or Stop pressed', async ({
  page,
}) => {
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  const gate = () =>
    page.evaluate(() => {
      const w = window as unknown as { gate: Promise<void>; open: () => void }
      w.gate = new Promise((r) => {
        w.open = r
      })
    })
  const release = () => page.evaluate(() => (window as unknown as { open: () => void }).open())
  const red = () => page.evaluate(() => nv.backgroundColor[0] === 1 && nv.backgroundColor[1] === 0)

  // Scene replaced (Close All) while the script waits on its own promise.
  await gate()
  await runScript(page, 'await window.gate\nnv.backgroundColor = [1, 0, 0, 1]')
  page.once('dialog', (d) => d.accept())
  await page.locator('.menubar-trigger', { hasText: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Close All', exact: true }).click()
  await release()
  await expect(page.locator('.output .error')).toContainText('another scene was opened')
  expect(await red()).toBe(false)

  // Stop pressed while the script waits.
  await gate()
  await runScript(page, 'await window.gate\nnv.backgroundColor = [1, 0, 0, 1]')
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>('button[aria-label="Stop script"]')?.click(),
  ) // Stop
  await release()
  await expect(page.locator('.output .error')).toContainText('Stopped')
  expect(await red()).toBe(false)
})

test('round 6 sweep: listeners end with the run; output from a finished run is dropped', async ({ page }) => {
  await drop(page, ['fslmean.nii.gz'])
  await expect.poll(() => page.evaluate(() => nv.volumes.length)).toBe(1)
  await runScript(
    page,
    "nv.addEventListener('volumeUpdated', () => console.log('listener'))\nsetTimeout(() => console.log('late'), 300)\nconsole.log('first')",
  )
  await expect(page.locator('.output')).toContainText('Done')
  await runScript(page, "console.log('second')")
  await expect(page.locator('.output')).toContainText('second')
  await page.evaluate(() => nv.setVolume(0, { opacity: 0.5 })) // would fire the first run's listener
  await page.waitForTimeout(500)
  await expect(page.locator('.output')).not.toContainText('listener')
  await expect(page.locator('.output')).not.toContainText('late')
})
