// Positive and negative values on a render; zero voxels fall below "darkest" and are not drawn.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([
  { url: 'spm152' },
  {
    url: 'spmMotor',
    colormap: 'warm',
    calMin: 0.01,
    calMax: 4,
    colormapNegative: 'winter',
    calMinNeg: -0.01,
    calMaxNeg: -4,
    opacity: 0.8,
  },
])
nv.sliceType = 4
nv.azimuth = 250
nv.elevation = 15
