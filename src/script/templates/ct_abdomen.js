// Spin a CT: bones first, then a kidney colormap. Esc stops.
await nv.removeAllMeshes()
nv.mosaicString = ''
nv.setClipPlanes([])
await nv.loadVolumes([{ url: 'CT_Abdo', calMin: -1024, calMax: 640 }])
nv.volumeRenderMode = 0
nv.sliceType = 4
nv.elevation = 30
const spin = async () => {
  for (let x = 1; x < 72; x++) {
    nv.azimuth = 200 - x * 5
    await nv.wait(30)
  }
}
await spin()
await nv.setVolume(0, { colormap: 'ct_kidneys' })
await spin()
