import { cortex, shiny } from '@niivue/niivue/assets/matcaps'
import NiiVue from '@niivue/niivue/webgl2'
import { useSyncExternalStore } from 'react'

// One scene per window (plan §3). App owns drop handling, so core drag-drop is off.
export const MATCAPS: Record<string, string> = { Cortex: cortex, Shiny: shiny }
export const nv = new NiiVue({ isDragDropEnabled: false, matcaps: MATCAPS })
nv.clipPlaneColor = [0.7, 0, 0.7, 0] // alpha 0: clip planes cut without drawing a plane, as in MRIcroGL
// ponytail: global for console debugging and e2e tests
;(globalThis as { nv?: NiiVue }).nv = nv

const EVENTS = [
  'change',
  'volumeLoaded',
  'volumeRemoved',
  'volumeUpdated',
  'volumeOrderChanged',
  'meshLoaded',
  'meshRemoved',
  'meshUpdated',
  'sliceTypeChange',
  'clipPlaneChange',
  'azimuthElevationChange',
  'locationChange',
  'documentLoaded',
  'frameChange',
] as const

// Revision snapshot: stable between events, bumped by any nv event.
let revision = 0
const listeners = new Set<() => void>()
export function bump() {
  revision++
  for (const f of listeners) f()
}
for (const e of EVENTS) nv.addEventListener(e, bump)

export const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => listeners.delete(f)
}
const getRevision = () => revision

/** Re-render on any nv event; derive values from nv directly. */
export function useNv<T>(select: (n: NiiVue) => T): T {
  useSyncExternalStore(subscribe, getRevision)
  return select(nv)
}

const attached = new WeakMap<HTMLCanvasElement, Promise<unknown>>()
/** Quality comes from preferences, applied before the GL context exists. Resolves once attached. */
export function attach(canvas: HTMLCanvasElement, quality: { antialias: boolean; pixelRatio: number }) {
  // StrictMode runs effects twice on the same element: both calls share one attach.
  let done = attached.get(canvas)
  if (!done) {
    nv.devicePixelRatio = quality.pixelRatio
    done = nv.attachToCanvas(canvas, quality.antialias)
    attached.set(canvas, done)
  }
  return done
}
