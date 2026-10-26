// Tour the mesh shaders while the camera spins. Esc stops.
await nv.removeAllVolumes()
nv.mosaicString = ''
await nv.loadMeshes([
  { url: 'BrainMesh_ICBM152.lh.mz3', color: [0.82, 0.58, 0.58, 1] },
  { url: 'LPBA40.jcon' },
])
nv.isLegendVisible = false // node names would cover the scene
await nv.setConnectomeOptions(1, {
  nodeColormap: 'red',
  nodeScale: 3,
  edgeColormap: 'actc',
  edgeMin: 0.5,
  edgeMax: 1,
})
nv.sliceType = 4
nv.elevation = 35
nv.setClipPlanes([])
const framesPerTurn = 90
for (const [turn, shader] of nv.meshShaders.entries()) {
  await nv.setMesh(0, { shaderType: shader })
  console.log(shader)
  for (let i = 0; i < framesPerTurn; i++) {
    nv.azimuth = 110 + (360 * (turn * framesPerTurn + i)) / framesPerTurn
    await nv.wait(10)
  }
}
