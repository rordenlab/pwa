import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { readNifti, sample } from './project'

test('reads NIfTI and samples at mm coordinates', async () => {
  const vol = await readNifti(new Blob([readFileSync('tests/fixtures/fslmean.nii.gz')]))
  expect(vol.dims.length).toBe(3)
  // The voxel at the volume center maps back to itself.
  const c = vol.dims.map((d) => Math.floor(d / 2))
  const [x, y, z] = c
  const v = vol.data[x + vol.dims[0] * (y + vol.dims[1] * z)]
  // Find mm of center by inverting toVox numerically: toVox is affine, so probe origin and axes.
  const o = vol.toVox(0, 0, 0)
  const ex = vol.toVox(1, 0, 0).map((q, i) => q - o[i])
  const ey = vol.toVox(0, 1, 0).map((q, i) => q - o[i])
  const ez = vol.toVox(0, 0, 1).map((q, i) => q - o[i])
  // Solve M·mm = c - o with Cramer's rule.
  const M = [0, 1, 2].map((r) => [ex[r], ey[r], ez[r]])
  const rhs = c.map((q, i) => q - o[i])
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const D = det(M)
  const mm = [0, 1, 2].map((k) => det(M.map((row, r) => row.map((val, j) => (j === k ? rhs[r] : val)))) / D)
  expect(sample(vol, new Float32Array(mm))[0]).toBeCloseTo(v)
  expect(sample(vol, new Float32Array([1e6, 1e6, 1e6]))[0]).toBe(0)
})

test('slope 0 disables scaling, including the intercept', async () => {
  const buf = new ArrayBuffer(353)
  const v = new DataView(buf)
  v.setInt32(0, 348, true)
  for (const [i, d] of [3, 1, 1, 1].entries()) v.setInt16(40 + i * 2, d, true)
  v.setInt16(70, 2, true) // uint8
  v.setFloat32(108, 352, true)
  v.setFloat32(112, 0, true)
  v.setFloat32(116, 100, true)
  v.setUint8(352, 7)
  expect((await readNifti(new Blob([buf]))).data[0]).toBe(7)
})
