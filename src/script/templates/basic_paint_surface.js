// Paint an fMRI volume onto the cortex: the app samples the voxel nearest each vertex.
await nv.removeAllVolumes()
nv.mosaicString = ''
nv.setClipPlanes([])
await nv.loadMeshes([{ url: 'BrainMesh_ICBM152.rh.mz3' }])
await nv.addMeshLayer(0, {
  url: 'motor_4t95vol.nii.gz',
  colormap: 'warm',
  calMin: 2,
  calMax: 12,
  colormapNegative: 'winter',
  calMinNeg: -1,
  calMaxNeg: -2,
  opacity: 0.75,
})
nv.isColorbarVisible = true
nv.sliceType = 4
nv.azimuth = 290
nv.elevation = 15
