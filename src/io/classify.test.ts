import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { classify, ext, stem } from './classify'

const fx = (n: string) => new File([readFileSync(`tests/fixtures/${n}`)], n)

test('extension and stem', () => {
  expect(ext('a/B.NII.GZ')).toBe('nii.gz')
  expect(ext('lh.pial')).toBe('pial')
  expect(stem('sub-01_bold.nii.gz')).toBe('sub-01_bold')
  expect(ext('stroke.trk.gz')).toBe('trk.gz')
})

test('classify by extension and header', async () => {
  expect(await classify(fx('fslmean.nii.gz'))).toBe('volume')
  expect(await classify(fx('BrainMesh_ICBM152.lh.mz3'))).toBe('mesh')
  expect(await classify(fx('BrainMesh_ICBM152.lh.motor.mz3'))).toBe('scalar')
  expect(await classify(fx('BrainMesh_ICBM152.lh.curv'))).toBe('scalar')
  expect(await classify(new File([''], 'scene.nvd'))).toBe('document')
  expect(await classify(new File([''], 'x.trk'))).toBe('tract')
  expect(await classify(new File([''], 'x.trk.gz'))).toBe('tract')
  expect(await classify(new File(['<GIFTI><DataArray Intent="NIFTI_INTENT_POINTSET">'], 'a.gii'))).toBe(
    'mesh',
  )
  expect(await classify(new File(['<GIFTI><DataArray Intent="NIFTI_INTENT_SHAPE">'], 'a.gii'))).toBe('scalar')
})
