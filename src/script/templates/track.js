// Tractography from a stroke patient, spun around. Esc stops.
await nv.removeAllVolumes()
nv.mosaicString = ''
nv.setClipPlanes([])
await nv.loadMeshes([{ url: 'stroke.trk.gz' }])
await nv.setTractOptions(0, { minLength: 15, fiberRadius: 0.5 })
nv.sliceType = 4
nv.elevation = 15
for (let i = 0; i < 72; i++) {
  nv.azimuth = 90 + i * 5
  await nv.wait(20)
}
