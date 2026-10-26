// Painted fMRI on a crevice-shaded cortex.
await nv.resetScene() // empty scene, default settings
await nv.loadMeshes([{ url: 'BrainMesh_ICBM152.rh.mz3', shaderType: 'crevice' }])
await nv.addMeshLayer(0, { url: 'motor_4t95vol.nii.gz', colormap: 'redyell', calMin: 2, calMax: 12 })
nv.sliceType = 4
nv.azimuth = 250
nv.elevation = 15
