// One clip plane through a render: [depth, azimuth, elevation].
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([
  { url: 'spm152' },
  { url: 'spmMotor', colormap: 'warm', calMin: 4, calMax: 8, opacity: 0.5 },
])
nv.sliceType = 4
nv.isClipPlaneCutaway = false
nv.setClipPlanes([[0.4, 0, 160]])
