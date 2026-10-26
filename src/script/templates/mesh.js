// Brain surface with an fMRI isosurface inside, seen with X-ray blending.
await nv.resetScene() // empty scene, default settings
await nv.loadMeshes([{ url: 'mni152_2009.mz3' }, { url: 'motor_4t95mesh.mz3', color: [1, 0.2, 0.2, 1] }])
nv.sliceType = 4
nv.meshXRay = 0.3
nv.azimuth = 270
nv.elevation = 20
