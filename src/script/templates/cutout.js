// MRIcroGL's cutout box, rebuilt from three clip planes in cutaway mode:
// cutaway removes only the block where all three planes overlap.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([
  { url: 'spm152' },
  {
    url: 'spmMotor',
    colormap: 'redyell',
    calMin: 2,
    calMax: 5,
    colormapNegative: 'winter',
    calMinNeg: -2,
    calMaxNeg: -5,
  },
])
nv.backgroundColor = [1, 1, 1, 1]
nv.sliceType = 4
nv.azimuth = 120
nv.elevation = 20
nv.isClipPlaneCutaway = true
nv.clipPlaneOverlay = true // overlays are cut too
nv.setClipPlanes([
  [0, 90, 0], // left
  [0, 180, 0], // anterior
  [0, 0, -90], // superior
])
