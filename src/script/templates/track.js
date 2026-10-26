// Tractography: one bundle (superior thalamic radiation, right) from the HCP-1065 atlas, spun around. Esc stops.
await nv.resetScene() // empty scene, default settings
await nv.loadMeshes([{ url: 'TR_S_R.tt.gz' }])
await nv.setTractOptions(0, { fiberRadius: 0.5 })
nv.sliceType = 4
nv.elevation = 15
for (let i = 0; i < 72; i++) {
  nv.azimuth = 90 + i * 5
  await nv.wait(20)
}
