// Cortex with painted fMRI and a translucent scalp.
await nv.resetScene() // empty scene, default settings
await nv.loadMeshes([
  { url: 'BrainMesh_ICBM152.rh.mz3' },
  { url: 'scalp.mz3', color: [0.83, 0.69, 0.22, 1], opacity: 0.4 },
])
await nv.addMeshLayer(0, { url: 'motor_4t95vol.nii.gz', colormap: 'hot', calMin: 2, calMax: 7 })
nv.isColorbarVisible = false
nv.sliceType = 4
nv.azimuth = 270
nv.elevation = 15
