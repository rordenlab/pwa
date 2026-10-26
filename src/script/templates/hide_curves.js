// Subcortical atlas inside a smoothed, see-through hemisphere.
await nv.resetScene() // empty scene, default settings
await nv.loadMeshes([
  { url: 'BrainMesh_ICBM152_smoothed.lh.mz3', shaderType: 'outline' },
  { url: 'CIT168.mz3' },
])
nv.sliceType = 4
nv.azimuth = 90
