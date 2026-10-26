import { markChanged } from './doc'
import { nv } from './nv'

// Scene operations shared by the layer tree, menus and tests.

/** Step a volume to position `to`, re-finding it before each step (others may move or vanish meanwhile). */
export async function moveVolumeTo(v: object, to: number) {
  for (let steps = nv.volumes.length; steps > 0; steps--) {
    const i = nv.volumes.indexOf(v as never)
    const target = Math.min(to, nv.volumes.length - 1)
    if (i < 0 || i === target) return
    await (i < target ? nv.moveVolumeUp(i) : nv.moveVolumeDown(i))
  }
}

/** Lossless mesh-layer reorder: core has no move method, but `mesh.layers` is the live array. */
export async function moveMeshLayer(mesh: number, from: number, to: number) {
  const layers = nv.meshes[mesh].layers
  layers.splice(to, 0, ...layers.splice(from, 1))
  await nv.setMeshLayerProperty(mesh, 0, {}) // re-composites and emits meshUpdated
}

// NVMeshLayer has no visibility flag: hidden means opacity 0 (so it survives .nvd save/load);
// hiding remembers the opacity so showing restores it.
const hiddenOpacity = new WeakMap<object, number>()
export const hiddenOpacityOf = (l: object) => hiddenOpacity.get(l)
export const setHiddenOpacity = (l: object, opacity: number) => hiddenOpacity.set(l, opacity)
export const isLayerVisible = (l: { opacity: number }) => l.opacity > 0
export async function setLayerVisible(mesh: number, layer: number, visible: boolean) {
  const l = nv.meshes[mesh].layers[layer]
  if (visible === isLayerVisible(l)) return
  if (visible) {
    const opacity = hiddenOpacity.get(l) ?? 1
    hiddenOpacity.delete(l)
    await nv.setMeshLayerProperty(mesh, layer, { opacity })
  } else {
    hiddenOpacity.set(l, l.opacity)
    await nv.setMeshLayerProperty(mesh, layer, { opacity: 0 })
  }
}

export function rename(obj: { name?: string }, name: string) {
  if (obj.name === name) return
  obj.name = name
  markChanged() // core emits no event for renames
}
