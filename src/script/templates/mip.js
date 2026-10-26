// Maximum intensity projection of an angiogram.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([{ url: 'chris_MRA' }])
nv.volumeRenderMode = 1 // MAXIMUM
nv.sliceType = 4
