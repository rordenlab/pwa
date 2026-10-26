// The AI brief: everything an assistant needs to write an MRIvue script. Pure, so the build script
// (public/llms.txt) and its freshness test share it. Keep it short: a curated API, not all ~300 members.
import type { Entry } from './apiParse'

export type BriefInput = {
  version: string
  members: Entry[]
  types: Record<string, string[]>
  samples: { name: string; group: string; desc: string; license: string }[]
  examples: { name: string; code: string }[]
}

/** The members an assistant needs, grouped as the brief presents them. */
export const CURATED: Record<string, string[]> = {
  'Load and remove': [
    'loadVolumes',
    'addVolume',
    'removeVolume',
    'removeAllVolumes',
    'moveVolumeUp',
    'moveVolumeDown',
    'loadMeshes',
    'addMesh',
    'removeMesh',
    'removeAllMeshes',
    'addMeshLayer',
    'removeMeshLayer',
  ],
  'Change appearance': [
    'setVolume',
    'setMesh',
    'setMeshLayerProperty',
    'setTractOptions',
    'setConnectomeOptions',
    'backgroundColor',
    'isColorbarVisible',
    'isLegendVisible',
    'isOrientCubeVisible',
    'isRadiological',
    'setColormapLabelFromUrl',
  ],
  'View and camera': [
    'sliceType',
    'mosaicString',
    'azimuth',
    'elevation',
    'setCrosshairPos',
    'scaleMultiplier',
  ],
  '3D rendering': [
    'setClipPlanes',
    'isClipPlaneCutaway',
    'clipPlaneColor',
    'volumeRenderMode',
    'volumeIllumination',
    'loadMatcap',
    'volumeSilhouette',
    'volumeGradientOpacity',
    'gamma',
    'meshXRay',
  ],
  'Read the scene': ['volumes', 'meshes', 'colormaps', 'meshShaders'],
}

const TYPES: [string, string][] = [
  [
    'ImageFromUrlOptions',
    'volume options for loadVolumes/addVolume; setVolume takes the same fields without url, plus frame4D',
  ],
  ['MeshFromUrlOptions', 'mesh options for loadMeshes/addMesh; setMesh takes the same fields without url'],
  [
    'MeshLayerFromUrlOptions',
    'per-vertex layer options for addMeshLayer; setMeshLayerProperty takes the same fields without url',
  ],
  ['NVTractOptions', 'setTractOptions fields'],
  ['NVConnectomeOptions', 'setConnectomeOptions fields'],
]

export function aiBrief({ version, members, types, samples, examples }: BriefInput): string {
  const byName = new Map(members.map((m) => [m.name, m]))
  const api = Object.entries(CURATED).map(
    ([group, names]) =>
      `### ${group}\n${names
        .map((n) => byName.get(n))
        .filter((m): m is Entry => !!m)
        .map((m) => `- \`${m.sig}\`${m.settable ? ' (settable)' : ''}${m.doc ? ` — ${m.doc}` : ''}`)
        .join('\n')}`,
  )
  const opts = TYPES.map(
    ([t, what]) => `### ${t} (${what})\n${(types[t] ?? []).map((f) => `- ${f}`).join('\n')}`,
  )
  const data = samples.map((s) => `- \`${s.name}\` (${s.group}) — ${s.desc}. License: ${s.license}.`)
  const ex = examples.map((e) => `### ${e.name}\n\`\`\`js\n${e.code.trim()}\n\`\`\``)
  return `# MRIvue scripting brief for AI assistants

> MRIvue is a browser viewer for brain volumes (NIfTI and more), meshes, tractography and connectomes, built on NiiVue ${version}. Users paste a script into its Script panel and press Run (or Shift+Enter).

## How to answer
Reply with ONE JavaScript code block, nothing else needed. It runs as the body of an async function:
- Top-level \`await\` works. The globals are \`nv\` (the viewer) and \`console\` (prints to the output pane).
- Begin with \`await nv.resetScene()\`: it empties the scene and restores fixed default settings (background, view, neurological convention, clip planes, mosaic, render options), whatever the user's preferences, so the result does not depend on earlier edits. Omit it only when the user asks to build on the current scene.
- Load data by file name, e.g. \`{ url: 'spm152' }\` (extension optional). Use the sample data below, or the user's own file names: MRIvue finds them in the user's folder or asks the user to locate them.
- \`nv.volumes[0]\` is the background; later volumes are overlays drawn on top. Await every load before using it.
- Change things through \`nv\` calls and properties (not by editing objects read from \`nv.volumes\`).
- Animate with \`await nv.wait(ms)\` inside loops; the user can stop with Esc.
- To give a one-click link instead, base64url-encode the UTF-8 script (no padding) into \`https://rordenlab.github.io/pwa/#script=<encoded>\`. The link opens the script for review; it runs only when the user presses Run. Keep links under ~8 KB; otherwise give the code block.
- Only use members listed here; check names with \`console.log(nv.colormaps)\` or \`console.log(nv.meshShaders)\` when unsure.

## Conventions
- sliceType: 0 axial, 1 coronal, 2 sagittal, 3 multiplanar, 4 render (3D). mosaicString like \`'A -20 0 20 40; S R 0'\` (A/C/S orientation, numbers are mm, R = rendered tile, ; = new row).
- Camera: azimuth 90 views the left side, 270 the right, 180 the front, 0 the back; elevation 90 views from above.
- Clip planes: \`nv.setClipPlanes([[depth, azimuth, elevation], ...])\`, depth -1..1, up to 6 planes; they cut volumes (not meshes). With \`isClipPlaneCutaway = true\` only the region where all planes overlap is removed.
- volumeRenderMode: 0 composite, 1 maximum intensity projection, 2 slices. Matcap lighting: \`await nv.loadMatcap('Cortex')\` (or 'Shiny') with \`nv.volumeIllumination = 0.5\`.
- Colormaps (case-insensitive) include gray, hot, warm, winter, red, green, blue, redyell, blue2red, actc, viridis, plasma, inferno, bone, jet, and CT maps (ct_bones, ct_kidneys, ct_brain, ct_soft_tissue). Two-sided statistics: \`colormap\` for positive values, \`colormapNegative\` with \`calMinNeg\`/\`calMaxNeg\` for negative ones.
- Mesh shaders: phong, flat, silhouette, rim, crevice, crosscut, matte, toon, outline.
- Paint a volume onto a cortical mesh: \`await nv.addMeshLayer(0, { url: 'motor_4t95vol', colormap: 'warm', calMin: 2, calMax: 12 })\` (MRIvue samples the volume at each vertex).

## Data available by name
${data.join('\n')}

## API (curated subset of NiiVue ${version})
${api.join('\n\n')}

## Option fields
${opts.join('\n\n')}

## Examples
${ex.join('\n\n')}
`
}

/** The current scene, so an assistant can build on it (appended by Help ▸ Copy Prompt for AI). */
export type SceneSummary = {
  volumes: { name: string; colormap?: string; calMin: number; calMax: number; colormapNegative?: string }[]
  meshes: { name?: string; kind: string; layers: (string | undefined)[] }[]
  sliceType: number
}
export function sceneSection(s: SceneSummary): string {
  const vols = s.volumes.map(
    (v, i) =>
      `- volume ${i}${i === 0 ? ' (background)' : ''}: ${v.name}, colormap ${v.colormap ?? 'gray'}, ${v.calMin}..${v.calMax}${v.colormapNegative ? `, negative colormap ${v.colormapNegative}` : ''}`,
  )
  const meshes = s.meshes.map(
    (m, i) =>
      `- mesh ${i} (${m.kind}): ${m.name}${m.layers.length ? `, layers: ${m.layers.join(', ')}` : ''}`,
  )
  const lines = [...vols, ...meshes]
  return `## Current scene\n${lines.length ? lines.join('\n') : '- empty'}\n- sliceType: ${s.sliceType}\n`
}
