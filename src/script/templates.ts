// Bundled demo scripts (Script ▸ Templates) and Insert snippets.
const files = import.meta.glob('./templates/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
export const templates = Object.entries(files)
  .map(([path, code]) => ({ name: path.slice(path.lastIndexOf('/') + 1, -3), code }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const snippets: [string, string][] = [
  ['Load volume', "await nv.addVolume({ url: 'spm152' })"],
  ['Load overlay', "await nv.addVolume({ url: 'spmMotor', colormap: 'warm', calMin: 4, calMax: 8 })"],
  ['Load mesh', "await nv.addMesh({ url: 'BrainMesh_ICBM152.lh.mz3' })"],
  ['Mesh layer', "await nv.addMeshLayer(0, { url: 'motor_4t95vol.nii.gz', calMin: 2, calMax: 12 })"],
  ['Volume settings', "await nv.setVolume(0, { colormap: 'gray', calMin: 0, calMax: 100, opacity: 1 })"],
  ['Render view', 'nv.sliceType = 4 // 0 axial, 1 coronal, 2 sagittal, 3 multiplanar, 4 render'],
  ['Camera', 'nv.azimuth = 110\nnv.elevation = 15'],
  ['Clip plane', 'nv.setClipPlanes([[0.3, 180, 20]]) // [depth, azimuth, elevation] per plane'],
  ['Mosaic', "nv.mosaicString = 'A -20 0 20 40; S R 0'"],
  ['Wait', 'await nv.wait(100) // ms; lets the scene redraw'],
  ['Reset scene', 'await nv.resetScene() // empty scene, default settings'],
  ['Print', 'console.log(nv.volumes.map((v) => v.name))'],
]
