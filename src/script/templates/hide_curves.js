// Subcortical atlas inside a smoothed, see-through hemisphere.
await nv.removeAllVolumes()
nv.mosaicString = ''
nv.setClipPlanes([])
await nv.loadMeshes([
  { url: 'BrainMesh_ICBM152_smoothed.lh.mz3', shaderType: 'rim', opacity: 0.5 },
  { url: 'CIT168.mz3' },
])
nv.sliceType = 4
nv.azimuth = 90
