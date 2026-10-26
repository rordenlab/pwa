// Background with a statistical overlay: positive (warm) and negative (winter) in one layer.
await nv.removeAllMeshes()
nv.mosaicString = ''
nv.setClipPlanes([])
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
nv.sliceType = 3 // multiplanar
