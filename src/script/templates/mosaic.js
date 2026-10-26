// Axial mosaic with labels, a sagittal cross-reference and a render tile.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([
  { url: 'spm152' },
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
nv.mosaicString = 'A L -24 -16 16 40 ; 48 56 S X 0 R 0'
