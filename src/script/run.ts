// Script runner (plan §7): trusted same-origin JS, explicit await, cooperative Stop.
import type NiiVue from '@niivue/niivue/webgl2'
import { doc, markChanged, scriptDocument } from '../doc'
import { enqueue } from '../io/files'
import { fetchFile } from '../io/fs'
import { asMeshLayer } from '../io/project'
import { bump, nv } from '../nv'
import { layerSet, resolve, retainNew } from './resolve'

export type Line = { kind: 'log' | 'warn' | 'error' | 'info'; text: string }
/** `docId`: the document the script works on; if the user opens or closes a scene, the script stops. */
type Token = {
  stopped: boolean
  docId: number
  /** True while this script's own loadDocument replaces the scene. */
  ownTransition: boolean
  /** Listeners the script added to nv; removed when the run ends. */
  listeners: [string, EventListenerOrEventListenerObject, unknown][]
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...a: unknown[]) => Promise<unknown>
const WRAPPER_LINES = 2 // "async function anonymous(nv,console\n) {\n"

let current: Token | null = null
export const isRunning = () => current !== null
export function stop() {
  if (current) current.stopped = true
  locator.close()
}

/** Set by the Locate dialog: `locate` resolves with a picked file or undefined; `close` cancels it. */
export const locator = {
  locate: async (_name: string): Promise<File | undefined> => undefined,
  close: () => {},
}
// One Locate dialog at a time, even when a script resolves files concurrently (Promise.all).
let locateTurn: Promise<unknown> = Promise.resolve()
function locateInTurn(name: string, t: Token): Promise<File | undefined> {
  const turn = locateTurn.then(() => (t.stopped ? undefined : locator.locate(name)))
  locateTurn = turn.catch(() => {})
  return turn
}

const check = (t: Token) => {
  if (t.stopped) throw new Error('Stopped')
  if (doc.id !== t.docId || (doc.busy && !t.ownTransition))
    throw new Error('Stopped: another scene was opened')
}

type Opts = { url?: unknown; layers?: Opts[] }
/** Resolve file references in a load argument; Files found are collected so they are retained only after the load succeeds. */
async function fix(o: unknown, t: Token, found: File[]): Promise<unknown> {
  if (typeof o === 'string') return resolveRef(o, t, found)
  if (Array.isArray(o)) {
    // One at a time: each missing file may need its own Locate dialog.
    const out: unknown[] = []
    for (const x of o) out.push(await fix(x, t, found))
    return out
  }
  if (o && typeof o === 'object' && 'url' in o) {
    const r = { ...(o as Opts & { name?: string }) }
    if (typeof r.url === 'string') {
      const ref = r.url
      r.url = await resolveRef(ref, t, found)
      // Name layers after the script's reference, not the resolved CDN URL.
      if (typeof r.url === 'string' && !r.name) r.name = r.url.slice(r.url.lastIndexOf('/') + 1)
    }
    if (Array.isArray(r.layers)) r.layers = (await fix(r.layers, t, found)) as Opts[]
    return r
  }
  return o // NVImage/NVMesh objects and other values pass through
}

const docName = (src: unknown) =>
  src instanceof File ? src.name : String(src).slice(String(src).lastIndexOf('/') + 1) || 'untitled.nvd'

/** Paint NIfTI data onto `mesh` if needed, then point the call at that mesh's current index. */
async function projectLayerArg(args: unknown[], mesh: (typeof nv.meshes)[number]) {
  const o = args[1] as { url: unknown }
  if (typeof o.url === 'string' && /\.nii(\.gz)?$/i.test(o.url)) o.url = await fetchFile(o.url)
  if (o.url instanceof File) o.url = await asMeshLayer(o.url, mesh.positions)
  // Resolution, queueing and projection all await: attach to the same mesh, wherever it is now.
  args[0] = nv.meshes.indexOf(mesh)
  if ((args[0] as number) < 0) throw new Error(`${mesh.name} was removed`)
}

async function resolveRef(ref: string, t: Token, found: File[]) {
  const hit = await resolve(ref, (name) => {
    check(t)
    return locateInTurn(name, t)
  }).catch((e) => {
    check(t) // a Locate cancelled by Stop reports "Stopped", not "Could not find"
    throw e
  })
  check(t)
  if (hit instanceof File) found.push(hit)
  return hit
}

// Async core loaders without file-reference arguments: they still run in the scene queue.
const QUEUED = new Set([
  'loadDrawing',
  'loadSignals',
  'addSignal',
  'setColormapLabelFromUrl',
  'addColormapFromUrl',
  'loadMatcap',
  'loadChunkedVolume',
])

// Persistent edits core reports no event for; scripts must mark the document changed too.
const EVENTLESS = new Set(['setClipPlanes', 'setClipPlane', 'setClipPlaneDepthAziElev', 'loadMatcap'])

// Methods whose file arguments are resolved, by argument position.
const LOADS: Record<string, number> = {
  loadImage: 0,
  addImage: 0,
  loadVolumes: 0,
  addVolume: 0,
  loadMeshes: 0,
  addMesh: 0,
  addMeshLayer: 1,
  loadDocument: 0,
}

function wrap(t: Token): NiiVue {
  const proxy: NiiVue = new Proxy(nv, {
    get(target, prop, _receiver) {
      if (prop === 'wait')
        return async (ms = 0) => {
          check(t)
          await new Promise((r) => setTimeout(r, ms))
          await new Promise((r) => requestAnimationFrame(r))
          check(t)
        }
      if (prop === 'addEventListener')
        return (type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
          check(t)
          target.addEventListener(type, fn, opts as AddEventListenerOptions)
          t.listeners.push([type, fn, opts]) // removed when the run ends
        }
      const value = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value
      const out = (r: unknown) => (r === target ? proxy : r)
      if (typeof prop === 'string' && QUEUED.has(prop))
        return async (...args: unknown[]) => {
          check(t)
          const r = await enqueue(async () => {
            check(t)
            return value.apply(target, args)
          })
          if (EVENTLESS.has(prop)) markChanged()
          else bump()
          check(t)
          return out(r)
        }
      if (typeof prop === 'string' && prop in LOADS)
        return async (...args: unknown[]) => {
          check(t)
          const i = LOADS[prop]
          // The target mesh as the script meant it, before any await can shift indices.
          const mesh = prop === 'addMeshLayer' ? nv.meshes[args[0] as number] : undefined
          if (prop === 'addMeshLayer' && !mesh) throw new Error(`no mesh at index ${args[0]}`)
          const found: File[] = []
          let before = layerSet()
          // Resolve first (may wait on a Locate dialog), then load in the scene queue, so drops,
          // opens and Close All never interleave with a script's load.
          args[i] = await fix(args[i], t, found)
          const load = async () => {
            check(t)
            if (mesh) await projectLayerArg(args, mesh)
            check(t) // Stop during projection must not still add the layer
            before = layerSet()
            return value.apply(target, args)
          }
          const r =
            prop === 'loadDocument'
              ? await scriptDocument(docName(args[0]), load, () => {
                  t.ownTransition = !t.stopped
                  return t.ownTransition
                }).finally(() => {
                  t.ownTransition = false
                  t.docId = doc.id // the script's own document is the one it now works on
                })
              : await enqueue(load)
          check(t) // skipped because stopped
          // Retain sources only once the load succeeded (a .nvd is never a layer source).
          if (prop !== 'loadDocument') retainNew(found, before) // the layers this load created
          bump()
          return out(r)
        }
      // Private class fields require the real instance as `this`.
      return (...args: unknown[]) => {
        check(t)
        const r = value.apply(target, args)
        if (EVENTLESS.has(prop as string)) markChanged()
        else bump()
        if (!(r instanceof Promise)) return out(r)
        return r.then((v) => {
          bump()
          check(t)
          return out(v)
        })
      }
    },
    // Assignments and other writes stop after Stop or once another scene was opened, like calls.
    defineProperty(target, prop, d) {
      check(t)
      return Reflect.defineProperty(target, prop, d)
    },
    deleteProperty(target, prop) {
      check(t)
      return Reflect.deleteProperty(target, prop)
    },
    setPrototypeOf() {
      return false
    },
    set(target, prop, v) {
      check(t) // assignments, like calls, stop after Stop or once another scene was opened
      const ok = Reflect.set(target, prop, v, target)
      bump()
      return ok
    },
  })
  return proxy
}

const MAX_TEXT = 2000 // one log line; a voxel array would otherwise become megabytes of DOM text
function show(x: unknown): string {
  if (typeof x === 'string') return x
  if (x instanceof Error) return x.message
  try {
    return JSON.stringify(x) ?? String(x)
  } catch {
    return String(x) // cycles (e.g. console.log(nv)), BigInt
  }
}
const fmt = (a: unknown[]) => {
  const text = a.map(show).join(' ')
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}… (${text.length} chars)` : text
}

/** Script line of an error, from the browser stack (sourceURL names the script). */
function errorLine(e: unknown): number | undefined {
  const m = String((e as Error)?.stack ?? '').match(/script\.js:(\d+):\d+/)
  return m ? Number(m[1]) - WRAPPER_LINES : undefined
}

export async function run(code: string, emit: (l: Line) => void) {
  if (current) return
  const t: Token = { stopped: false, docId: doc.id, ownTransition: false, listeners: [] }
  current = t
  const log =
    (kind: Line['kind']) =>
    (...a: unknown[]) => {
      if (current === t) emit({ kind, text: fmt(a) }) // a leftover timer must not write into a later run
    }
  const con = { log: log('log'), info: log('info'), warn: log('warn'), error: log('error') }
  const start = performance.now()
  try {
    const f = new AsyncFunction('nv', 'console', `${code}\n//# sourceURL=script.js`)
    await f(wrap(t), con)
    emit({ kind: 'info', text: `Done (${Math.round(performance.now() - start)} ms)` })
  } catch (e) {
    const line = errorLine(e)
    emit({ kind: 'error', text: `${(e as Error)?.message ?? e}${line ? ` (line ${line})` : ''}` })
  } finally {
    for (const [type, fn, opts] of t.listeners) nv.removeEventListener(type, fn, opts as EventListenerOptions)
    t.stopped = true // queued Locate requests from this run are skipped
    locator.close() // and an open one is dismissed: nothing would consume its answer
    current = null
  }
}
