// Background with a statistical overlay: positive (warm) and negative (winter) in one layer.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([
  { url: 'spm152', isColorbarVisible: false }, // anatomy: no colorbar entry
  {
    url: 'spmMotor',
    colormap: 'warm',
    calMin: 4,
    calMax: 4.01,
    colormapNegative: 'winter',
    calMinNeg: -4,
    calMaxNeg: -4.01,
    opacity: 0.5,
  },
])
nv.isColorbarVisible = true // colorbars for the statistical map only
nv.sliceType = 3 // multiplanar
