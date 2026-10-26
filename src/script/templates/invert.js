// Inverted grayscale on a white background.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([{ url: 'chris_t2', calMin: 2, calMax: 155, isColormapInverted: true }])
nv.backgroundColor = [1, 1, 1, 1]
nv.sliceType = 1 // coronal
