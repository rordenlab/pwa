import type { Item, Menu } from './menu/menus'
import { bump, nv } from './nv'

// App-owned state (plan §3): selection and user messages. Scene state stays in nv.
export type Selection = { volume: number } | { mesh: number; layer?: number } | null

export const app = {
  selection: null as Selection,
  message: '',
  /** BIDS sidecars by layer object, shown with the header. */
  sidecars: new WeakMap<object, unknown>(),
  /** Set by the script panel (M3). */
  openScript: undefined as ((f: File) => void) | undefined,
  insertScript: undefined as ((text: string) => void) | undefined,
  workspace: undefined as FileSystemDirectoryHandle | undefined,
  togglePane: undefined as ((p: 'tools' | 'script', open?: boolean) => void) | undefined,
  /** Menus contributed by later features (Script, Help). */
  extraMenus: undefined as Menu[] | undefined,
  editMenu: undefined as Item[] | undefined,
  helpMenu: undefined as Item[] | undefined,
  showInstallHelp: undefined as (() => void) | undefined,
  reloadToUpdate: undefined as (() => unknown) | undefined,
}

// The selection is shown as positions, but it means objects: positions shift when layers are added,
// removed or reordered (by scripts, drops, other panels), so it is re-derived after each change.
type Picked = { layer: object; mesh?: object } | null
let picked: Picked = null

function objectOf(s: Selection): Picked {
  if (!s) return null
  if ('volume' in s) return nv.volumes[s.volume] ? { layer: nv.volumes[s.volume] } : null
  const m = nv.meshes[s.mesh]
  if (!m) return null
  if (s.layer === undefined) return { layer: m }
  return m.layers[s.layer] ? { layer: m.layers[s.layer], mesh: m } : null
}

function positionOf(p: Picked): Selection {
  if (!p) return null
  const v = nv.volumes.indexOf(p.layer as never)
  if (v >= 0) return { volume: v }
  if (!p.mesh) {
    const m = nv.meshes.indexOf(p.layer as never)
    return m >= 0 ? { mesh: m } : null
  }
  const m = nv.meshes.indexOf(p.mesh as never)
  const l = m >= 0 ? nv.meshes[m].layers.indexOf(p.layer as never) : -1
  return l >= 0 ? { mesh: m, layer: l } : null
}

export function select(s: Selection) {
  picked = objectOf(s)
  app.selection = positionOf(picked)
  bump()
}

function follow() {
  const s = positionOf(picked)
  if (JSON.stringify(s) === JSON.stringify(app.selection)) return
  if (!s) picked = null // the selected layer is gone
  app.selection = s
  bump()
}
for (const e of [
  'volumeLoaded',
  'volumeRemoved',
  'volumeOrderChanged',
  'meshLoaded',
  'meshRemoved',
  'meshUpdated',
  'documentLoaded',
] as const)
  nv.addEventListener(e, follow)

export function notify(msg: string) {
  app.message = msg
  bump()
}

export const selectedMesh = (): number | undefined =>
  app.selection && 'mesh' in app.selection ? app.selection.mesh : undefined
/** The selected surface mesh object, for work that waits (queues, pickers) before using it. */
export const selectedSurfaceObject = () => {
  const i = selectedSurface()
  return i === undefined ? undefined : nv.meshes[i]
}
/** Selected surface mesh (not a tract or connectome): the only valid target for per-vertex data. */
export const selectedSurface = (): number | undefined => {
  const i = selectedMesh()
  return i !== undefined && nv.meshes[i]?.kind === 'mesh' ? i : undefined
}
