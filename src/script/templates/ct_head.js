// CT with a tissue colormap and an oblique clip plane.
await nv.removeAllMeshes()
nv.mosaicString = ''
await nv.loadVolumes([{ url: 'CT_Philips', colormap: 'ct_kidneys' }])
nv.volumeRenderMode = 0
nv.sliceType = 4
nv.azimuth = 210
nv.elevation = 10
nv.setClipPlanes([[0.25, 180, 60]])
