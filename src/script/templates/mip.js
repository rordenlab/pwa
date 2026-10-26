// Maximum intensity projection of an angiogram.
await nv.removeAllMeshes()
nv.mosaicString = ''
nv.setClipPlanes([])
await nv.loadVolumes([{ url: 'chris_MRA' }])
nv.volumeRenderMode = 1 // MAXIMUM
nv.sliceType = 4
