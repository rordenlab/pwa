// "Glass brain": silhouette rendering with an overlay, viewed from the side.
await nv.removeAllMeshes()
nv.mosaicString = ''
nv.setClipPlanes([])
await nv.loadVolumes([{ url: 'mni152' }, { url: 'spmMotor', colormap: 'warm', calMin: 4, calMax: 8 }])
nv.volumeSilhouette = 0.6
nv.volumeGradientOpacity = 0.6
nv.backgroundColor = [1, 1, 1, 1]
nv.sliceType = 4
nv.azimuth = 90 // left side
nv.elevation = 0
