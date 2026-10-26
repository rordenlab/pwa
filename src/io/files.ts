import { SLICE_TYPE } from '@niivue/niivue/webgl2'
import { nv } from '../nv'
import { prefs } from '../prefs'
import { layerSet, liveLayers, retain } from '../script/resolve'
import { app, notify, selectedSurfaceObject } from '../state'
import { classifyOrVolume, type Kind, stem } from './classify'
import { asMeshLayer } from './project'

/** Documents and scripts are routed by openPicked before files get here. */
export type Opened = { failed?: boolean }

// Scene changes from drops and opens run one at a time, in arrival order.
let queue: Promise<unknown> = Promise.resolve()
export function enqueue<T>(f: () => Promise<T>): Promise<T> {
  const run = queue.then(f)
  queue = run.catch(() => {})
  return run
}

/** `target`: the selected mesh object (not its index, which shifts if an earlier mesh is removed while queued). */
export function addFiles(files: File[], target = selectedSurfaceObject()): Promise<Opened> {
  return enqueue(() => addNow(files, target))
}

type Mesh = (typeof nv.meshes)[number]

/**
 * Add files to the mixed scene by the §6 rules. Validation happens before any scene
 * mutation; files are then added sequentially in input order.
 */
export async function addNow(files: File[], target: Mesh | undefined): Promise<Opened> {
  const kinds = await Promise.all(files.map(classifyOrVolume))
  const of = (k: Kind) => files.filter((_, i) => kinds[i] === k)

  const scalars = of('scalar')
  if (target && !nv.meshes.includes(target)) {
    notify(`${target.name} was removed before its per-vertex files could be added.`)
    return { failed: true }
  }
  let mesh = target
  const targetsNewMesh = mesh === undefined && of('mesh').length === 1
  if (scalars.length && mesh === undefined && !targetsNewMesh) {
    const surfaces = nv.meshes.filter((m) => m.kind === 'mesh')
    if (of('mesh').length === 0 && surfaces.length === 1) mesh = surfaces[0]
    else {
      notify('Select a mesh in the layer list, then add the per-vertex files.')
      return { failed: true }
    }
  }

  const wasEmpty = !nv.volumes.length && !nv.meshes.length
  const sidecars = new Map(of('sidecar').map((f) => [stem(f.name), f]))
  const done: string[] = []
  // Input order, except per-vertex files wait for the mesh they attach to.
  const order = [...files.keys()].sort(
    (a, b) => Number(kinds[a] === 'scalar') - Number(kinds[b] === 'scalar'),
  )
  for (const i of order) {
    const [f, kind] = [files[i], kinds[i]]
    try {
      let layer: object | undefined
      // The layer this load created (not "the last one", which a concurrent removal can change).
      const before = layerSet()
      const created = () => liveLayers().find((l) => !before.has(l))
      if (kind === 'volume') {
        await nv.addVolume({ url: f })
        layer = created()
        const json = sidecars.get(stem(f.name))
        if (json) {
          sidecars.delete(stem(f.name))
          try {
            if (layer) app.sidecars.set(layer, JSON.parse(await json.text()))
          } catch {
            notify(`Ignored unreadable sidecar ${json.name}`) // the volume itself loaded fine
          }
        }
      } else if (kind === 'mesh' || kind === 'tract' || kind === 'connectome') {
        await nv.addMesh({ url: f })
        layer = created()
        if (!nv.volumes.length) nv.sliceType = SLICE_TYPE.RENDER // Surfice: meshes are 3D
        if (kind === 'mesh' && targetsNewMesh) mesh = layer as Mesh
      } else if (kind === 'scalar') {
        layer = await addMeshLayer(mesh as Mesh, f)
      }
      if (kind !== 'sidecar') {
        done.push(f.name)
        // Only after a successful load, and tied to this layer: a failed or other same-name file never replaces it.
        if (layer) retain(f, layer)
      }
    } catch (e) {
      notify(
        `Failed to load ${f.name}: ${(e as Error).message}${done.length ? ` (added ${done.join(', ')})` : ''}`,
      )
      return { failed: true }
    }
  }
  if (wasEmpty && nv.volumes.length) nv.sliceType = prefs.startupView
  const unpaired = [...sidecars.values()].map((f) => f.name)
  notify(unpaired.length ? `Ignored unpaired sidecar: ${unpaired.join(', ')}` : '')
  return {}
}

/**
 * Attach per-vertex data to this mesh, found again after any async projection; returns the new layer.
 * Vertex count must match (which does not prove the data belongs to this anatomy).
 */
export async function addMeshLayer(mesh: Mesh, f: File) {
  const url = await asMeshLayer(f, mesh.positions)
  const i = nv.meshes.indexOf(mesh)
  if (i < 0) throw new Error(`${mesh.name} was removed`)
  const n = mesh.layers.length
  await nv.addMeshLayer(i, { url })
  if (mesh.layers.length === n) throw new Error(`vertex count does not match ${mesh.name}`)
  return mesh.layers[mesh.layers.length - 1]
}
