// AAL atlas over the MNI152 template, as in NiiVue's vox.atlas demo. The label table (aal.json)
// names each region: click a voxel and the status bar shows the region under the crosshair.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([
  { url: 'mni152', calMin: 30, calMax: 80, isColorbarVisible: false },
  { url: 'aal', opacity: 0.5, isNearestInterpolation: true },
])
await nv.setColormapLabelFromUrl(1, 'aal.json')
nv.volumeIsAlphaClipDark = true
nv.isColorbarVisible = true
nv.sliceType = 3 // multiplanar
nv.showRender = 1
