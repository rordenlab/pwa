// Sweep a clip plane down through the brain. Esc stops.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([{ url: 'spm152' }, { url: 'spmMotor', colormap: 'warm', calMin: 4, calMax: 8 }])
nv.backgroundColor = [1, 1, 1, 1]
nv.sliceType = 4
nv.azimuth = 250
nv.elevation = 15
nv.isClipPlaneCutaway = false
for (let x = 1; x <= 12; x++) {
  nv.setClipPlanes([[1 - x * 0.1, 0, 90]]) // [depth, azimuth, elevation]: superior plane moving down
  await nv.wait(100)
}
