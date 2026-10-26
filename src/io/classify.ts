// Drop/open classification (plan §6). Extension lists mirror the pinned core readers.
export type Kind = 'document' | 'script' | 'sidecar' | 'mesh' | 'tract' | 'connectome' | 'scalar' | 'volume'

const MESH =
  'asc dfs byu geo nv ico iwm.cbor obj srf ply wrl off stl x3d vtk pial white inflated sphere orig smoothwm qsphere'
const TRACT = 'tck tt trx trk'
const SCALAR = 'stc curv crv thickness area sulc smp'
const SNIFF = new Set(['gii', 'mz3'])
const table = new Map<string, Kind>()
for (const [list, kind] of [
  [MESH, 'mesh'],
  [TRACT, 'tract'],
  [SCALAR, 'scalar'],
] as const)
  for (const e of list.split(' ')) table.set(e, kind)
table.set('jcon', 'connectome').set('nvd', 'document').set('js', 'script').set('json', 'sidecar')

export function ext(name: string): string {
  const n = name.toLowerCase()
  for (const two of ['iwm.cbor', 'nii.gz', 'src.gz']) if (n.endsWith(`.${two}`)) return two
  if (n.endsWith('.gz')) return `${ext(n.slice(0, -3))}.gz` // core reads x.trk.gz as trk
  const dot = n.lastIndexOf('.')
  return dot < 0 ? '' : n.slice(dot + 1)
}

/** Stem used to pair `x.json` with `x.nii.gz`. */
export function stem(name: string): string {
  const e = ext(name)
  return e ? name.slice(0, -(e.length + 1)) : name
}

const HEAD = 1 << 16 // enough for GIfTI headers without reading whole files

/** First HEAD bytes, gunzipped if needed. */
async function bytes(f: Blob): Promise<Uint8Array> {
  const magic = new Uint8Array(await f.slice(0, 2).arrayBuffer())
  if (magic[0] !== 0x1f || magic[1] !== 0x8b) return new Uint8Array(await f.slice(0, HEAD).arrayBuffer())
  const r = f.stream().pipeThrough(new DecompressionStream('gzip')).getReader()
  const parts: Uint8Array[] = []
  let n = 0
  while (n < HEAD) {
    const { value, done } = await r.read()
    if (done) break
    parts.push(value)
    n += value.length
  }
  r.cancel().catch(() => {})
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** GIfTI/MZ3 carry either geometry or per-vertex scalars: read the header to tell. */
async function hasGeometry(f: Blob, e: string): Promise<boolean> {
  const b = await bytes(f)
  if (e === 'mz3') return b[0] === 0x4d && b[1] === 0x5a && (b[2] & 1) === 1 // attr bit0 = faces
  // Geometry GIfTI has a POINTSET or TRIANGLE array; whichever comes first appears early.
  return /NIFTI_INTENT_(POINTSET|TRIANGLE)/.test(new TextDecoder().decode(b))
}

export async function classify(f: File): Promise<Kind> {
  const e = ext(f.name)
  if (SNIFF.has(e.replace(/\.gz$/, '')))
    return (await hasGeometry(f, e.replace(/\.gz$/, ''))) ? 'mesh' : 'scalar'
  return table.get(e.replace(/\.gz$/, '')) ?? 'volume'
}

/** One unreadable file must not fail a whole drop: let core load it and report the error. */
export const classifyOrVolume = (f: File): Promise<Kind> => classify(f).catch(() => 'volume')
