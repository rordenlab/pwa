await nv.resetScene() // empty scene, default settings
await nv.loadMeshes([
  { url: 'BrainMesh_ICBM152.rh.mz3', shaderType: 'crevice' },
  { url: 'motor_4t95mesh.mz3', color: [1, 0, 0, 1] },
])
nv.sliceType = 4
nv.meshXRay = 0.15
nv.azimuth = 250
nv.elevation = 15
