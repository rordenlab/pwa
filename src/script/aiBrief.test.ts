import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { generate } from '../../scripts/llms'
import { CURATED, sceneSection } from './aiBrief'
import { parseMembers } from './apiParse'

test('public/llms.txt is up to date (run `bun run llms` after changing templates, catalog or NiiVue)', () => {
  expect(readFileSync('public/llms.txt', 'utf8')).toBe(generate())
})

test('every curated API name exists in the pinned NiiVue', () => {
  const names = new Set(
    parseMembers(readFileSync('node_modules/@niivue/niivue/dist/NVControlBase.d.ts', 'utf8')).map(
      (m) => m.name,
    ),
  )
  expect(
    Object.values(CURATED)
      .flat()
      .filter((n) => !names.has(n)),
  ).toEqual([])
})

test('scene section describes layers', () => {
  const text = sceneSection({
    volumes: [{ name: 'spm152.nii.gz', colormap: 'gray', calMin: 0, calMax: 100 }],
    meshes: [{ name: 'lh.mz3', kind: 'mesh', layers: ['motor.mz3'] }],
    sliceType: 4,
  })
  expect(text).toContain('volume 0 (background): spm152.nii.gz')
  expect(text).toContain('layers: motor.mz3')
})
