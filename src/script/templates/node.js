// Connectome (nodes and edges) inside a see-through left hemisphere.
nv.meshXRay = 0.3
await nv.removeAllVolumes()
nv.mosaicString = ''
await nv.loadMeshes([{ url: 'BrainMesh_ICBM152.lh.mz3' }, { url: 'LPBA40.jcon' }])
nv.isLegendVisible = false // node names would cover the scene
await nv.setConnectomeOptions(1, {
  nodeColormap: 'blue',
  nodeScale: 3,
  edgeColormap: 'actc',
  edgeMin: 0.5,
  edgeMax: 1,
  edgeScale: 1.5,
})
nv.sliceType = 4
nv.azimuth = 110
nv.elevation = 35
nv.setClipPlanes([]) // ponytail: rc.37 does not clip meshes
