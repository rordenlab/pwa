// Bare-name resolution for script loads (plan §7): loaded sources → workspace folder →
// recent handles → bundled catalog → "Locate" dialog. Cached per session.
import { samples } from '../catalog'
import { doc } from '../doc'
import { inRecent, inWorkspace } from '../io/fs'
import { nv } from '../nv'
import { app } from '../state'

const EXTS = ['', '.nii.gz', '.nii', '.mz3', '.gii']
const isUrl = (s: string) => /^(https?|blob|data):/i.test(s)
const cache = new Map<string, File | string>()
let cachedWorkspace: FileSystemDirectoryHandle | undefined

/** Source File or URL of each loaded layer (volume, mesh or mesh layer), keyed by the layer object
 * itself: two subjects both named scan.nii.gz keep their own sources, and a removed layer's source
 * is never found again. */
const sourceOf = new WeakMap<object, File | string>()

type Layer = { name?: string }
/** Volumes, then each mesh followed by its layers: a stable order that a document reload reproduces. */
export const liveLayers = (): Layer[] => [...nv.volumes, ...nv.meshes.flatMap((m) => [m, ...m.layers])]

export const sourceFor = (layer: object) => sourceOf.get(layer)

/** Remember where a layer came from, after it loaded successfully. */
export function retain(source: File | string, layer: object) {
  sourceOf.set(layer, source)
}

/** The layers present now; pass to `retainNew` after a load to find what it created. */
export const layerSet = () => new Set<object>(liveLayers())

/**
 * After a script load: match its resolved files to the layers that load created, in order and by
 * name. A single file creating a single layer matches even when renamed (projected .mz3, `name:`).
 */
export function retainNew(files: File[], before: Set<object>) {
  const fresh = liveLayers().filter((l) => !before.has(l))
  if (files.length === 1 && fresh.length === 1) return retain(files[0], fresh[0])
  for (const f of files) {
    const layer = fresh.find((l) => l.name === f.name && !sourceOf.has(l))
    if (layer) retain(f, layer)
  }
}

/** A new document: forget located files from the previous one. */
export function resetResolver() {
  cache.clear()
}

function inCatalog(name: string): string | undefined {
  for (const e of EXTS) {
    const hits = samples.filter((s) => s.name === name + e)
    if (hits.length === 1) return hits[0].url
  }
  return undefined
}

/** Only layers still in the scene count; with duplicate names the newest wins. */
function loaded(name: string): File | string | undefined {
  const live = liveLayers().reverse()
  for (const e of EXTS)
    for (const l of live) {
      const source = l.name === name + e ? sourceOf.get(l) : undefined
      if (source) return source
    }
  return undefined
}

/** Resolve one script file reference. Remote URLs pass through unchanged. */
export async function resolve(
  ref: string,
  locate: (name: string) => Promise<File | undefined>,
): Promise<File | string> {
  if (isUrl(ref)) return ref
  if (cachedWorkspace !== app.workspace) {
    cache.clear() // mappings depend on the granted folder
    cachedWorkspace = app.workspace
  }
  const base = ref.slice(ref.lastIndexOf('/') + 1)
  // A layer in the scene now wins over anything cached, and is not cached itself.
  const live = ref.includes('/') ? undefined : loaded(base)
  if (live) return live
  const hit = cache.get(ref)
  if (hit) return hit
  const found =
    (app.workspace && (await inWorkspace(app.workspace, ref))) ??
    (await inRecent(doc.recent, base)) ??
    inCatalog(base) ??
    (await locate(base))
  if (!found) throw new Error(`Could not find '${ref}'`)
  cache.set(ref, found)
  return found
}
