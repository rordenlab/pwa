// One statistical map with positive (warm) and negative (winter) values, loaded with nearest-neighbor
// interpolation. NiiVue colors each overlay voxel before filtering, so threshold edges follow the voxel
// grid; MRIcroGL's smooth overlays (interpolate the statistic, then threshold) are not in this NiiVue release.
await nv.removeAllMeshes()
nv.mosaicString = ''
nv.setClipPlanes([])
await nv.loadVolumes([
  { url: 'spm152' },
  {
    url: 'spmMotor',
    colormap: 'warm',
    calMin: 4,
    calMax: 8,
    colormapNegative: 'winter',
    calMinNeg: -4,
    calMaxNeg: -8,
    isNearestInterpolation: true,
  },
])
nv.sliceType = 4
