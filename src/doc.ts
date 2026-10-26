// Document state and file commands (plan §6). File I/O goes through src/io.
import { classifyOrVolume, ext } from './io/classify'
import { addFiles, addNow, enqueue } from './io/files'
import {
  addRecent,
  download,
  fetchFile,
  gzip,
  loadRecent,
  loadWorkspace,
  onLaunch,
  type Picked,
  permitted,
  pickSave,
  type Recent,
  write,
} from './io/fs'
import { hiddenOpacityOf, setHiddenOpacity } from './layers'
import { bump, nv } from './nv'
import { pixelRatio, prefs } from './prefs'
import { liveLayers, resetResolver, retain, sourceFor } from './script/resolve'
import { app, notify, select, selectedSurfaceObject } from './state'

export const doc = {
  name: 'untitled.nvd',
  handle: undefined as FileSystemFileHandle | undefined,
  dirty: false,
  recent: [] as Recent[],
  /** Bumped on every change; a save only marks clean if nothing changed while it ran. */
  revision: 0,
  /** Bumped when a different document takes over the scene. */
  id: 0,
  /** A scene replacement is in progress (scripts must not edit the scene being replaced). */
  busy: false,
}
// ponytail: global for console debugging and e2e tests, like nv
;(globalThis as { doc?: typeof doc }).doc = doc
loadRecent().then((r) => {
  doc.recent = r
  bump()
})
loadWorkspace().then((w) => {
  app.workspace = w
})
onLaunch((items) => openPicked(items, true))

// Camera moves do not mark the document changed (plan §15.5).
const CAMERA = new Set(['azimuth', 'elevation', 'crosshairPos', 'pan2Dxyzmm', 'scaleMultiplier', 'renderPan'])
const setDirty = (dirty: boolean) => {
  if (dirty) doc.revision++
  if (doc.dirty === dirty) return
  doc.dirty = dirty
  bump()
}
/** For persistent edits core reports no event for (rename, setClipPlanes, loadMatcap). */
export function markChanged() {
  setDirty(true)
  bump() // these edits have no core event, so refresh the UI here
}
/** A different document now owns the scene: retained script sources no longer apply. */
function newDocument(name: string, handle?: FileSystemFileHandle) {
  Object.assign(doc, { name, handle, id: doc.id + 1 })
  resetResolver()
  setDirty(false) // a new document starts clean
  bump()
}
for (const e of [
  'volumeLoaded',
  'volumeRemoved',
  'volumeUpdated',
  'volumeOrderChanged',
  'meshLoaded',
  'meshRemoved',
  'meshUpdated',
  'sliceTypeChange',
  'clipPlaneChange',
] as const)
  nv.addEventListener(e, () => setDirty(true))
nv.addEventListener('change', (e) => !CAMERA.has(e.detail.property) && setDirty(true))
nv.addEventListener('documentLoaded', () => setDirty(false))
addEventListener('beforeunload', (e) => {
  if (doc.dirty) e.preventDefault()
})

const okToDiscard = () => !doc.dirty || confirm('Discard unsaved changes to the current scene?')

async function rememberRecent(items: Picked[]) {
  const withHandles = items.filter((p) => p.handle).map((p) => ({ name: p.file.name, handle: p.handle }))
  if (withHandles.length) doc.recent = await addRecent(withHandles)
  bump()
}

async function clearScene() {
  await nv.removeAllMeshes()
  await nv.removeAllVolumes()
  newDocument('untitled.nvd')
}

const snapshot = () => (nv.volumes.length + nv.meshes.length ? nv.serializeDocument() : null)

/**
 * App data keyed by layer object (script sources, BIDS sidecars, opacity of hidden mesh layers).
 * A rollback recreates the layers from the snapshot, so this is carried over by position.
 */
const layerData = () =>
  liveLayers().map((l) => ({
    source: sourceFor(l),
    sidecar: app.sidecars.get(l),
    opacity: hiddenOpacityOf(l),
  }))
function restoreLayerData(data: ReturnType<typeof layerData>) {
  const now = liveLayers()
  if (now.length !== data.length) return // not the same scene shape: nothing safe to map
  now.forEach((l, i) => {
    const { source, sidecar, opacity } = data[i]
    if (source) retain(source, l)
    if (sidecar !== undefined) app.sidecars.set(l, sidecar)
    if (opacity !== undefined) setHiddenOpacity(l, opacity)
  })
}

/**
 * Every scene replacement runs here: in the drop queue (so a drop still loading cannot land in
 * the new scene), asking before discarding edits, and restoring the previous scene with its
 * name, save handle and unsaved state if `run` fails (throws or returns false).
 * Resolves with the error if the transition failed (and was rolled back), else undefined.
 */
function transition(
  label: string,
  run: () => Promise<boolean>,
  { proceed = okToDiscard, backup = true } = {},
): Promise<Error | undefined> {
  return enqueue(async () => {
    if (!proceed()) return undefined // decided when the transition runs, not when it was queued
    doc.busy = true
    try {
      return await replace(label, run, backup)
    } finally {
      doc.busy = false
    }
  })
}

async function replace(
  label: string,
  run: () => Promise<boolean>,
  backup: boolean,
): Promise<Error | undefined> {
  // Restores the previous scene (data, name, handle, unsaved state, selection, per-layer data) on failure.
  const before = {
    ...doc,
    backup: backup ? snapshot() : null,
    layers: layerData(),
    selection: app.selection,
  }
  select(null)
  let error: Error | undefined
  const ok = await run().catch((e) => {
    error = e as Error
    notify(`Could not open ${label}: ${error.message}`)
    return false
  })
  if (ok) return undefined
  try {
    if (before.backup) {
      await nv.loadDocument(new File([before.backup.slice()], before.name))
      restoreLayerData(before.layers)
      select(before.selection) // same positions in the restored scene
    } else await clearScene()
  } catch (e) {
    notify(`Could not restore the previous scene: ${(e as Error).message}`)
  }
  // Same document again: keep its identity so a save in progress still completes.
  Object.assign(doc, { name: before.name, handle: before.handle, id: before.id })
  setDirty(before.dirty) // documentLoaded marked it clean
  bump()
  return error ?? new Error(`${label} could not be loaded`)
}

// Clearing cannot fail, so no snapshot (which would briefly double memory for large scenes).
export const closeAll = () =>
  transition(
    '',
    async () => {
      await clearScene()
      return true
    },
    { backup: false },
  )

/** Load a .nvd; on failure restore the previous scene. */
const openDocument = (file: File, handle?: FileSystemFileHandle) =>
  transition(file.name, async () => {
    await nv.loadDocument(file)
    newDocument(file.name, handle)
    return true
  })

/**
 * A script called nv.loadDocument: same bookkeeping, no prompt (the script asked for it).
 * `proceed` lets a stopped script skip the replacement instead of failing (and restoring) it.
 */
export async function scriptDocument(name: string, load: () => Promise<unknown>, proceed: () => boolean) {
  const error = await transition(
    name,
    async () => {
      await load()
      newDocument(name) // no handle: Save asks where, never overwrites the previous file
      return true
    },
    { proceed },
  )
  if (error) throw error // the script stops instead of running on the restored scene
}

/** Open: a document replaces the scene; data files start a new scene. Errors go to the status bar. */
export function openPicked(items: Picked[], replace: boolean) {
  const target = selectedSurfaceObject() // the mesh selected when the user acted, before any await
  return openNow(items, replace, target).catch((e) => notify(`Could not open: ${(e as Error).message}`))
}

async function openNow(items: Picked[], replace: boolean, target: ReturnType<typeof selectedSurfaceObject>) {
  if (!items.length) return
  const files = items.map((p) => p.file)
  const kinds = await Promise.all(files.map(classifyOrVolume))
  await rememberRecent(items)
  const d = kinds.indexOf('document')
  if (d >= 0) {
    if (files.length > 1) return notify('Open a single .nvd document on its own.')
    return openDocument(files[d], items[d].handle)
  }
  // Scripts go to the editor without touching the scene.
  const script = files.find((_, i) => kinds[i] === 'script')
  if (script) app.openScript?.(script)
  const data = files.filter((_, i) => kinds[i] !== 'script')
  if (!data.length) return
  if (!replace) return void (await addFiles(data, target))
  await transition(data[0].name, async () => {
    await clearScene()
    return !(await addNow(data, undefined)).failed
  })
}

export async function openRecent(r: Recent) {
  try {
    if (r.handle) {
      if (!(await permitted(r.handle))) return notify(`Permission to read ${r.name} was not granted.`)
      return openPicked([{ file: await r.handle.getFile(), handle: r.handle }], true)
    }
    if (r.url) {
      return openPicked([{ file: await fetchFile(r.url, r.name) }], true)
    }
  } catch (e) {
    notify(`Could not open ${r.name}: ${(e as Error).message}`)
  }
}

/**
 * Pick the destination now (while the click still counts as user activation), then produce and
 * write the data inside the scene queue: a save never captures a scene that is mid-load, and
 * writes happen in request order. Resolves with the handle, null (downloaded) or undefined (cancelled).
 */
async function saveTo(name: string, data: () => Promise<Blob>, existing?: FileSystemFileHandle) {
  const handle = existing ?? (await pickSave(name))
  if (handle === undefined) return undefined
  await enqueue(async () => {
    const blob = await data()
    if (handle) await write(handle, blob)
    else download(name, blob)
  })
  return handle
}

const docBlob = async () => new Blob([nv.serializeDocument().slice()])

export async function saveDocument(as = false) {
  const { id, handle: current } = doc
  const name = doc.name.endsWith('.nvd') ? doc.name : `${doc.name}.nvd`
  let revision = doc.revision
  try {
    if (!as && current && !(await permitted(current, 'readwrite')))
      return notify('Write permission was not granted.')
    const handle = await saveTo(
      name,
      async () => {
        // Runs in the queue, after any pending open: only the document this save was for.
        if (doc.id !== id) throw new Error('another document was opened')
        revision = doc.revision
        return docBlob()
      },
      as ? undefined : current,
    )
    if (handle === undefined) return // cancelled: stays dirty
    if (handle && handle !== current) {
      doc.recent = await addRecent([{ name: handle.name, handle }])
      if (doc.id === id) Object.assign(doc, { handle, name: handle.name })
    }
    if (doc.id === id && doc.revision === revision) setDirty(false)
    notify(`Saved ${handle?.name ?? name}`)
  } catch (e) {
    notify(`Save failed: ${(e as Error).message}`)
  }
}

const frame = () => new Promise((r) => requestAnimationFrame(r))

/** Current canvas pixels at the preferred bitmap zoom; render first because the WebGL buffer is not preserved. */
async function screenshot(): Promise<Blob> {
  const src = nv.canvas as HTMLCanvasElement
  const zoom = prefs.bitmapZoom
  if (zoom > 1) {
    nv.devicePixelRatio = pixelRatio() * zoom
    await frame()
    await frame()
  }
  nv.view?.render()
  const c = Object.assign(document.createElement('canvas'), { width: src.width, height: src.height })
  c.getContext('2d')?.drawImage(src, 0, 0)
  if (zoom > 1) nv.devicePixelRatio = pixelRatio() // back to the chosen resolution
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'),
  )
}

const base = (name = 'untitled') => name.replace(/\.(nii\.gz|[^.]+)$/i, '')

export const saveScreenshot = () =>
  saveTo(`${base(doc.name)}.png`, screenshot).catch((e) => notify(`Save failed: ${e.message}`))

export async function copyScreenshot() {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': screenshot() })])
    notify('Screenshot copied')
  } catch (e) {
    notify(`Copy failed: ${(e as Error).message}`)
  }
}

/** Export the selected (or background) volume's current voxels as NIfTI. */
export function saveVolume() {
  const i = app.selection && 'volume' in app.selection ? app.selection.volume : 0
  const v = nv.volumes[i]
  if (!v) return notify('No volume to save.')
  const name = ext(v.name) === 'nii' ? v.name : `${base(v.name)}.nii.gz`
  return saveTo(name, async () => {
    // The scene may have changed while the picker was open: export this volume, wherever it is now.
    const index = nv.volumes.indexOf(v)
    if (index < 0) throw new Error(`${v.name} was removed before it could be saved`)
    const bytes = (await nv.saveVolume({ volumeByIndex: index })) as Uint8Array
    const blob = new Blob([bytes.slice()])
    return name.endsWith('.gz') ? gzip(blob) : blob
  }).catch((e) => notify(`Save failed: ${(e as Error).message}`))
}

/** Surfice's native MZ3: header, uint32 faces, float32 vertices (gzip). */
function mz3(positions: Float32Array, indices: Uint32Array): Blob {
  const head = new DataView(new ArrayBuffer(16))
  head.setUint16(0, 0x5a4d, true) // "MZ"
  head.setUint16(2, 3, true) // faces + vertices
  head.setUint32(4, indices.length / 3, true)
  head.setUint32(8, positions.length / 3, true)
  return new Blob([head, indices.slice(), positions.slice()])
}

export function saveMesh() {
  const i = app.selection && 'mesh' in app.selection ? app.selection.mesh : 0
  const m = nv.meshes[i]
  if (m?.kind !== 'mesh') return notify('Select a mesh to save.')
  return saveTo(`${base(m.name)}.mz3`, async () => {
    if (!nv.meshes.includes(m)) throw new Error(`${m.name} was removed before it could be saved`)
    return gzip(mz3(m.positions, m.indices))
  }).catch((e) => notify(`Save failed: ${e.message}`))
}
