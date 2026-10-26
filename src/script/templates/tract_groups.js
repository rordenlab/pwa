// Tract groups, as in NiiVue's tract.groups demo: an atlas of named bundles (TRX format) over MNI152.
// Only the groups listed in groupColors are drawn, each in its color. Tracts ▸ Groups… picks groups interactively.
await nv.resetScene() // empty scene, default settings
await nv.loadVolumes([{ url: 'mni152' }])
await nv.loadMeshes([{ url: 'yeh2022.trx', rgba255: [0, 142, 200, 255] }])
const groups = nv.getTractGroups(0)
console.log(`${groups.length} groups, e.g. ${groups.slice(0, 3).join(', ')}`)
await nv.setTractOptions(0, {
  groupColors: {
    [groups[0]]: [0, 255, 0, 255],
    [groups[1]]: [255, 0, 0, 255],
    [groups[2]]: [25, 25, 255, 255],
  },
})
nv.setClipPlanes([
  [0.1, 180, 20],
  [0.1, 0, -20],
])
nv.backgroundColor = [1, 1, 1, 1]
nv.sliceType = 4
