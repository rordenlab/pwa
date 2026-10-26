// Axial, coronal and sagittal renderings from both sides, on white.
await nv.removeAllMeshes()
nv.setClipPlanes([])
nv.backgroundColor = [1, 1, 1, 1]
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
nv.isColorbarVisible = false
nv.mosaicString = 'A R 0 C R 0 S R 0 ; A R -0 C R -0 S R -0'
