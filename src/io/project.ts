// Paint a NIfTI volume onto mesh vertices (Surfice's volume overlay), which core lacks:
// sample the voxel nearest each vertex and hand core a scalar-only MZ3 layer.
// ponytail: NIfTI-1 only, nearest neighbor; add NIfTI-2/trilinear if users need them.

type Vol = { data: Float32Array; dims: number[]; toVox: (x: number, y: number, z: number) => number[] }

const TYPES: Record<number, (b: ArrayBuffer, o: number, n: number) => ArrayLike<number>> = {
  2: (b, o, n) => new Uint8Array(b, o, n),
  4: (b, o, n) => new Int16Array(b, o, n),
  8: (b, o, n) => new Int32Array(b, o, n),
  16: (b, o, n) => new Float32Array(b, o, n),
  64: (b, o, n) => new Float64Array(b, o, n),
  256: (b, o, n) => new Int8Array(b, o, n),
  512: (b, o, n) => new Uint16Array(b, o, n),
  768: (b, o, n) => new Uint32Array(b, o, n),
}

async function bytes(f: Blob): Promise<ArrayBuffer> {
  const head = new Uint8Array(await f.slice(0, 2).arrayBuffer())
  const s =
    head[0] === 0x1f && head[1] === 0x8b
      ? f.stream().pipeThrough(new DecompressionStream('gzip'))
      : f.stream()
  return new Response(s).arrayBuffer()
}

/** Voxel→mm affine rows: sform if set, else qform quaternion, else pixdim scaling. */
function affine(v: DataView, le: boolean): number[][] {
  const f = (o: number) => v.getFloat32(o, le)
  if (v.getInt16(254, le) > 0) return [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => f(280 + r * 16 + c * 4)))
  const [dx, dy, dz] = [f(80), f(84), f(88)]
  if (v.getInt16(252, le) <= 0)
    return [
      [dx, 0, 0, 0],
      [0, dy, 0, 0],
      [0, 0, dz, 0],
    ]
  const [b, c, d] = [f(256), f(260), f(264)]
  const a = Math.sqrt(Math.max(0, 1 - b * b - c * c - d * d))
  const qfac = f(76) < 0 ? -1 : 1
  const R = [
    [a * a + b * b - c * c - d * d, 2 * (b * c - a * d), 2 * (b * d + a * c)],
    [2 * (b * c + a * d), a * a + c * c - b * b - d * d, 2 * (c * d - a * b)],
    [2 * (b * d - a * c), 2 * (c * d + a * b), a * a + d * d - c * c - b * b],
  ]
  const off = [f(268), f(272), f(276)]
  return R.map((row, r) => [row[0] * dx, row[1] * dy, row[2] * dz * qfac, off[r]])
}

export async function readNifti(f: Blob): Promise<Vol> {
  const buf = await bytes(f)
  const v = new DataView(buf)
  const le = v.getInt32(0, true) === 348
  if (!le)
    throw new Error(v.getInt32(0, false) === 348 ? 'big-endian NIfTI not supported' : 'not a NIfTI-1 file')
  const dims = [1, 2, 3].map((i) => Math.max(1, v.getInt16(40 + i * 2, le)))
  const n = dims[0] * dims[1] * dims[2]
  const type = v.getInt16(70, le)
  const offset = Math.max(352, v.getFloat32(108, le))
  if (!TYPES[type]) throw new Error(`unsupported NIfTI datatype ${type}`)
  // Typed views need aligned offsets; copy when the voxel data is not aligned.
  const raw = TYPES[type](offset % 8 ? buf.slice(offset) : buf, offset % 8 ? 0 : offset, n)
  // NIfTI: scl_slope 0 means "no scaling", so the intercept is ignored too.
  const rawSlope = v.getFloat32(112, le)
  const slope = rawSlope || 1
  const inter = rawSlope ? v.getFloat32(116, le) : 0
  const data = Float32Array.from(raw, (x) => x * slope + inter)
  const A = affine(v, le)
  // Invert the 3×3 linear part plus translation.
  const [[a, b, c, tx], [d, e, g, ty], [h, i, k, tz]] = A
  const det = a * (e * k - g * i) - b * (d * k - g * h) + c * (d * i - e * h)
  const inv = [
    [(e * k - g * i) / det, (c * i - b * k) / det, (b * g - c * e) / det],
    [(g * h - d * k) / det, (a * k - c * h) / det, (c * d - a * g) / det],
    [(d * i - e * h) / det, (b * h - a * i) / det, (a * e - b * d) / det],
  ]
  const toVox = (x: number, y: number, z: number) => {
    const p = [x - tx, y - ty, z - tz]
    return inv.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2])
  }
  return { data, dims, toVox }
}

export function sample(vol: Vol, positions: Float32Array): Float32Array {
  const [nx, ny, nz] = vol.dims
  const out = new Float32Array(positions.length / 3)
  for (let p = 0; p < out.length; p++) {
    const [x, y, z] = vol.toVox(positions[p * 3], positions[p * 3 + 1], positions[p * 3 + 2]).map(Math.round)
    if (x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz) out[p] = vol.data[x + nx * (y + ny * z)]
  }
  return out
}

/** Scalar-only MZ3 (attr 8) that core reads as a mesh layer. */
function scalarMz3(values: Float32Array): Uint8Array {
  const out = new Uint8Array(16 + values.byteLength)
  const v = new DataView(out.buffer)
  v.setUint16(0, 0x5a4d, true)
  v.setUint16(2, 8, true)
  v.setUint32(8, values.length, true)
  out.set(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), 16)
  return out
}

/** A NIfTI whose voxel count differs from the vertex count is painted onto the mesh; others pass through. */
export async function asMeshLayer(f: File, positions: Float32Array): Promise<File> {
  if (!/\.nii(\.gz)?$/i.test(f.name)) return f
  const vol = await readNifti(f)
  if (vol.data.length === positions.length / 3) return f
  // Core picks the reader by extension, so the projected layer is named .mz3.
  return new File([scalarMz3(sample(vol, positions)).slice()], f.name.replace(/\.nii(\.gz)?$/i, '.mz3'))
}
