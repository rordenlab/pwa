// Display settings: Edit ▸ Undo/Redo, and nv.resetScene() for scripts.
// Undo/Redo covers display settings (colormaps, thresholds, opacity, render, clip planes).
// A snapshot is taken once changes settle. Adding, removing or reordering layers starts a new
// history, because undoing those would mean reloading data. The camera is not part of history.
import { doc, markChanged } from './doc'
import { MATCAPS, nv, subscribe } from './nv'

// Color settings shared by volumes and mesh layers.
const COLOR = [
  'colormap',
  'colormapNegative',
  'calMin',
  'calMax',
  'calMinNeg',
  'calMaxNeg',
  'opacity',
  'isColormapInverted',
  'isColorbarVisible',
] as const
const VOLUME = [...COLOR, 'colormapType', 'visible', 'isNearestInterpolation', 'frame4D'] as const
const MESH = [
  'opacity',
  'color',
  'shaderType',
  'visible',
  'isColorbarVisible',
  'tractOptions',
  'connectomeOptions',
] as const
const LAYER = [...COLOR, 'outlineWidth'] as const
const SCENE = [
  'sliceType',
  'mosaicString',
  'backgroundColor',
  'isColorbarVisible',
  'isLegendVisible',
  'isRadiological',
  'volumeRenderMode',
  'volumeIllumination',
  'volumeGradientOpacity',
  'volumeSilhouette',
  'volumeSampleRate',
  'gamma',
  'volumeOutlineWidth',
  'volumeOverlayAlphaBlend',
  'volumeOverlayColorBlend',
  'isClipPlaneCutaway',
  'clipPlaneColor',
  'clipPlaneOverlay',
  'meshXRay',
  'crosshairWidth',
  'multiplanarType',
] as const

type Obj = Record<string, unknown>
const pick = (o: object, keys: readonly string[]) =>
  Object.fromEntries(keys.map((k) => [k, structuredClone((o as Obj)[k])]))

// Scene settings as NiiVue starts, before preferences or edits (neurological convention, default view).
const DEFAULTS = pick(nv, [...SCENE, 'azimuth', 'elevation', 'scaleMultiplier'])

/** Empty scene with fixed default settings, so a script gives the same result after any edits and
 * with any preferences (radiological convention, startup view). */
export async function resetScene() {
  await nv.removeAllMeshes()
  await nv.removeAllVolumes()
  Object.assign(nv, structuredClone(DEFAULTS))
  nv.setClipPlanes([])
  markChanged() // clip planes emit no event
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function take() {
  const entries: [object, Obj][] = [
    ...nv.volumes.map((v): [object, Obj] => [v, pick(v, VOLUME)]),
    ...nv.meshes.flatMap((m): [object, Obj][] => [
      [m, pick(m, MESH)],
      ...m.layers.map((l): [object, Obj] => [l, pick(l, LAYER)]),
    ]),
  ]
  const layers = entries.map((e) => e[0])
  const props = entries.map((e) => e[1])
  const scene = pick(nv, SCENE)
  scene.clip = [0, 1, 2, 3, 4, 5].map((i) => nv.getClipPlaneDepthAziElev(i))
  scene.matcap = nv.volumeMatcap
  return { layers, state: { props, scene } }
}
type Snap = ReturnType<typeof take>

let past: Snap[] = []
let future: Snap[] = []
let applying = false
let timer: ReturnType<typeof setTimeout> | undefined

function record() {
  clearTimeout(timer)
  timer = undefined
  if (applying) return
  const s = take()
  const top = past.at(-1)
  if (!top || top.layers.length !== s.layers.length || top.layers.some((l, i) => l !== s.layers[i])) {
    past = [s] // a different set of layers: earlier states cannot be restored
    future = []
  } else if (!same(top.state, s.state)) {
    past.push(s)
    future = []
  }
}
// ponytail: JSON compare of every setting after each settle; fine for tens of layers.
subscribe(() => {
  clearTimeout(timer)
  timer = setTimeout(record, 400) // one step per slider drag or typed value
})

const diff = (from: Obj, to: Obj) =>
  Object.fromEntries(Object.entries(to).filter(([k, v]) => !same(from[k], v)))

async function apply(s: Snap) {
  const now = take()
  if (now.layers.length !== s.layers.length || now.layers.some((l, i) => l !== s.layers[i])) {
    past = [now] // the scene changed under history: nothing safe to restore
    future = []
    return
  }
  applying = true
  try {
    for (const [i, layer] of s.layers.entries()) {
      const d = diff(now.state.props[i], s.state.props[i])
      if (!Object.keys(d).length) continue
      const vi = nv.volumes.indexOf(layer as never)
      if (vi >= 0) await nv.setVolume(vi, d)
      const mi = nv.meshes.indexOf(layer as never)
      if (mi >= 0) await nv.setMesh(mi, d)
      const owner = nv.meshes.findIndex((m) => m.layers.includes(layer as never))
      if (owner >= 0) await nv.setMeshLayerProperty(owner, nv.meshes[owner].layers.indexOf(layer as never), d)
    }
    const { clip, matcap, ...scene } = diff(now.state.scene, s.state.scene)
    Object.assign(nv, scene)
    if (clip) nv.setClipPlanes(clip as number[][])
    const name = Object.keys(MATCAPS).find((k) => MATCAPS[k] === matcap)
    if (name) await nv.loadMatcap(name)
    markChanged() // clip planes and matcaps emit no event
  } finally {
    applying = false
    clearTimeout(timer) // the events above restored a recorded state
  }
}

export const canUndo = () => past.length > 1 || timer !== undefined
export const canRedo = () => future.length > 0

/** Settle pending changes; false while another scene is opening (its layers are not history's). */
function ready() {
  if (doc.busy) return false
  if (timer) record() // a change still settling counts as the latest step; a new scene resets history
  return true
}

export async function undo() {
  if (!ready() || past.length < 2) return
  future.push(past.pop() as Snap)
  await apply(past.at(-1) as Snap)
}

export async function redo() {
  if (!ready()) return
  const s = future.pop()
  if (!s) return
  past.push(s)
  await apply(s)
}
