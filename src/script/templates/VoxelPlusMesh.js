// Voxels and meshes in one scene, inspired by NiiVue's dev demo: the MNI152 volume opened by two clip
// planes, subcortical nuclei (CIT168) inside a half-transparent scalp, and one tract bundle.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([{ url: 'mni152' }])
await nv.loadMeshes([
  { url: 'CIT168.mz3' },
  { url: 'TR_S_R.tt.gz', rgba255: [0, 255, 255, 255], tractOptions: { fiberRadius: 0.5 } },
  { url: 'scalp.mz3', color: [1, 0.8, 1, 1], opacity: 0.5 }, // translucent: draw last
])
nv.setClipPlanes([
  [0.1, 180, 20],
  [0.1, 0, -20],
])
nv.clipPlaneColor = [0.7, 0, 0.7, -0.2] // negative alpha: shade the cut faces
await nv.loadMatcap('Cortex')
nv.volumeIllumination = 0.4
nv.volumeIsAlphaClipDark = true
nv.isLegendVisible = false // CIT168 lists ~30 regions: the legend would cover the view
nv.sliceType = 3 // multiplanar: axial, coronal, sagittal and a 3D render
nv.elevation = 15
