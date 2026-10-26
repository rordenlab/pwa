import { OVERLAY_ALPHA_BLEND, SLICE_TYPE } from '@niivue/niivue/webgl2'
import { groups, samples } from '../catalog'
import {
  closeAll,
  copyScreenshot,
  doc,
  openPicked,
  openRecent,
  saveDocument,
  saveMesh,
  saveScreenshot,
  saveVolume,
} from '../doc'
import { isInstalled, promptInstall } from '../install'
import { addFiles, addMeshLayer, enqueue } from '../io/files'
import { addRecent, fetchFile, hasFSA, pickFiles, pickWorkspace } from '../io/fs'
import { bump, nv } from '../nv'
import { fromHex, toHex } from '../panels/fields'
import { prefs, RESOLUTIONS, type Resolution, setQuality } from '../prefs'
import { retain } from '../script/resolve'
import { app, notify, selectedMesh, selectedSurface } from '../state'

export type Item =
  | {
      label: string
      shortcut?: string
      /** Shortcut handled by a focused widget (e.g. the editor), not globally. */
      local?: boolean
      run?: () => unknown
      checked?: boolean
      disabled?: boolean
      items?: Item[]
    }
  | 'sep'
export type Menu = { label: string; items: Item[] }

// Named directions (MRIcroGL Display ▸ L/R/P/A/I/S): in 3D they turn the camera to that side
// (NiiVue convention: azimuth 90 looks at the left side); in 2D they step the crosshair one
// voxel that way on core's RAS voxel grid (+i right, +j anterior, +k superior).
export const VIEWS = {
  Left: [90, 0, 'L', [-1, 0, 0]],
  Right: [270, 0, 'R', [1, 0, 0]],
  Posterior: [0, 0, 'P', [0, -1, 0]],
  Anterior: [180, 0, 'A', [0, 1, 0]],
  Inferior: [0, -90, 'I', [0, 0, -1]],
  Superior: [0, 90, 'S', [0, 0, 1]],
} as const
const DEFAULT_MOSAIC = 'A -20 -10 0 10 20 30; A 40 50 60 70 80 90'

function view(az: number, el: number, step: readonly number[]) {
  if (nv.sliceType === SLICE_TYPE.RENDER || !nv.volumes.length) {
    nv.azimuth = az
    nv.elevation = el
  } else nv.moveCrosshairInVox(step[0], step[1], step[2])
}

function setSlice(t: number) {
  nv.mosaicString = ''
  nv.sliceType = t
}

const selVolume = () => (app.selection && 'volume' in app.selection ? app.selection.volume : 0)

async function frame(step: number) {
  const i = selVolume()
  const v = nv.volumes[i]
  if (!v || (v.nFrame4D ?? 1) < 2) return
  await nv.setVolume(i, { frame4D: ((v.frame4D ?? 0) + step + (v.nFrame4D ?? 1)) % (v.nFrame4D ?? 1) })
}

async function openSample(s: { name: string; url: string }) {
  try {
    notify(`Loading ${s.name}…`)
    if ((await addFiles([await fetchFile(s.url, s.name)])).failed) return
    doc.recent = await addRecent([{ name: s.name, url: s.url }])
    bump()
  } catch (e) {
    notify(`Could not load ${s.name}: ${(e as Error).message}`)
  }
}

function pickColor(initial: ArrayLike<number>, apply: (rgb: number[]) => void) {
  const input = Object.assign(document.createElement('input'), { type: 'color', value: toHex(initial) })
  input.oninput = () => apply(fromHex(input.value))
  input.click()
}

function colormapTarget(): { value?: string; set?: (c: string) => unknown } {
  const s = app.selection
  if (!s) return {}
  if ('volume' in s)
    return { value: nv.volumes[s.volume]?.colormap, set: (colormap) => nv.setVolume(s.volume, { colormap }) }
  if (s.layer !== undefined) {
    const l = nv.meshes[s.mesh]?.layers[s.layer]
    return {
      value: l?.colormap,
      set: (colormap) => nv.setMeshLayerProperty(s.mesh, s.layer as number, { colormap }),
    }
  }
  return {}
}

/** Menubar contents, rebuilt on every render from current scene state. */
export function menus(): Menu[] {
  const st = nv.sliceType
  const mosaic = !!nv.mosaicString
  const volume = nv.volumes[selVolume()]
  const meshI = selectedMesh() ?? 0
  const mesh = nv.meshes[meshI]
  const cmap = colormapTarget()
  const radio = (label: string, checked: boolean, run: () => unknown, shortcut?: string): Item => ({
    label,
    checked,
    run,
    shortcut,
  })
  return [
    {
      label: 'File',
      items: [
        { label: 'New Window', shortcut: 'Mod+Alt+N', run: () => open(location.href, '_blank', 'noopener') },
        ...(isInstalled()
          ? []
          : [
              {
                label: 'Install as App…',
                run: async () => (await promptInstall()) || app.showInstallHelp?.(),
              },
            ]),
        { label: 'Open…', shortcut: 'Mod+O', run: async () => openPicked(await pickFiles(), true) },
        {
          label: 'Open Folder…',
          disabled: !hasFSA,
          run: async () => {
            const dir = await pickWorkspace()
            if (dir) {
              app.workspace = dir
              notify(`Workspace: ${dir.name}`)
            }
          },
        },
        {
          label: 'Open Recent',
          disabled: !doc.recent.length,
          items: doc.recent.map((r) => ({ label: r.name, run: () => openRecent(r) })),
        },
        {
          label: 'Open Sample',
          items: groups.map((g) => ({
            label: g,
            items: samples
              .filter((s) => s.group === g)
              .map((s) => ({ label: s.name, run: () => openSample(s) })),
          })),
        },
        'sep',
        {
          label: 'Add Mesh/Volume…',
          shortcut: 'Mod+Shift+O',
          run: async () => openPicked(await pickFiles(), false),
        },
        {
          label: 'Add Mesh Layer…',
          disabled: !nv.meshes.some((m) => m.kind === 'mesh'),
          run: async () => {
            const target = nv.meshes[selectedSurface() ?? nv.meshes.findIndex((m) => m.kind === 'mesh')]
            // Retain the source so scripts can find this layer by name, as for dropped files.
            for (const { file } of await pickFiles())
              await enqueue(async () => retain(file, await addMeshLayer(target, file))).catch((e) =>
                notify(`${file.name}: ${e.message}`),
              )
          },
        },
        'sep',
        { label: 'Save Document', shortcut: 'Mod+S', run: () => saveDocument() },
        { label: 'Save Document As…', shortcut: 'Mod+Shift+S', run: () => saveDocument(true) },
        { label: 'Save Screenshot…', disabled: !nv.volumes.length && !nv.meshes.length, run: saveScreenshot },
        { label: 'Save Volume…', disabled: !nv.volumes.length, run: saveVolume },
        { label: 'Save Mesh…', disabled: !nv.meshes.some((m) => m.kind === 'mesh'), run: saveMesh },
        'sep',
        { label: 'Close All', run: () => closeAll() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Copy Screenshot', shortcut: 'Mod+Shift+C', run: copyScreenshot },
        ...(app.editMenu ?? []),
      ],
    },
    {
      label: 'View',
      items: [
        radio('Axial', !mosaic && st === SLICE_TYPE.AXIAL, () => setSlice(SLICE_TYPE.AXIAL)),
        radio('Coronal', !mosaic && st === SLICE_TYPE.CORONAL, () => setSlice(SLICE_TYPE.CORONAL)),
        radio('Sagittal', !mosaic && st === SLICE_TYPE.SAGITTAL, () => setSlice(SLICE_TYPE.SAGITTAL)),
        radio('Multiplanar', !mosaic && st === SLICE_TYPE.MULTIPLANAR, () =>
          setSlice(SLICE_TYPE.MULTIPLANAR),
        ),
        radio('Render', !mosaic && st === SLICE_TYPE.RENDER, () => setSlice(SLICE_TYPE.RENDER)),
        radio('Mosaic', mosaic, () => {
          nv.mosaicString ||= DEFAULT_MOSAIC
        }),
        'sep',
        ...Object.entries(VIEWS).map(
          ([name, [az, el, key, step]]): Item => ({
            label: name,
            shortcut: `Alt+${key}`,
            run: () => view(az, el, step),
          }),
        ),
        'sep',
        {
          label: 'Radiological',
          checked: nv.isRadiological,
          run: () => {
            nv.isRadiological = !nv.isRadiological
          },
        },
        {
          label: 'Orientation Cube',
          checked: nv.isOrientCubeVisible,
          run: () => {
            nv.isOrientCubeVisible = !nv.isOrientCubeVisible
          },
        },
        {
          label: 'Colorbar',
          checked: nv.isColorbarVisible,
          run: () => {
            nv.isColorbarVisible = !nv.isColorbarVisible
          },
        },
        {
          label: 'Reset View',
          run: () => {
            nv.azimuth = 110
            nv.elevation = 10
            nv.scaleMultiplier = 1
            nv.pan2Dxyzmm = [0, 0, 0, 1]
          },
        },
        'sep',
        { label: 'Toggle Tools', shortcut: 'Mod+B', run: () => app.togglePane?.('tools') },
        { label: 'Toggle Script', shortcut: 'Mod+J', run: () => app.togglePane?.('script') },
        {
          label: 'Full Screen',
          run: () =>
            document.fullscreenElement
              ? document.exitFullscreen()
              : document.documentElement.requestFullscreen(),
        },
        {
          // Per-device display quality; also in Preferences. Changing it rebuilds the GL view.
          label: 'Quality',
          items: [
            {
              label: 'Antialiasing (MSAA)',
              checked: prefs.antialias,
              run: () => setQuality({ antialias: !prefs.antialias }),
            },
            'sep',
            ...(Object.entries(RESOLUTIONS) as [Resolution, string][]).map(([r, label]) =>
              radio(label, prefs.resolution === r, () => setQuality({ resolution: r })),
            ),
          ],
        },
      ],
    },
    {
      label: 'Volume',
      items: [
        {
          label: 'Next Frame',
          shortcut: 'Alt+N',
          disabled: (volume?.nFrame4D ?? 1) < 2,
          run: () => frame(1),
        },
        {
          label: 'Previous Frame',
          shortcut: 'Alt+V',
          disabled: (volume?.nFrame4D ?? 1) < 2,
          run: () => frame(-1),
        },
        'sep',
        {
          label: 'Overlay Blending',
          items: (['MAX', 'ADDITIVE', 'OVER'] as const).map((k) =>
            radio(
              k[0] + k.slice(1).toLowerCase(),
              nv.volumeOverlayAlphaBlend === OVERLAY_ALPHA_BLEND[k],
              () => {
                nv.volumeOverlayAlphaBlend = OVERLAY_ALPHA_BLEND[k]
              },
            ),
          ),
        },
        {
          label: 'Transparent Below Darkest',
          disabled: !volume,
          checked: volume?.isTransparentBelowCalMin ?? false,
          run: () =>
            nv.setVolume(selVolume(), { isTransparentBelowCalMin: !volume?.isTransparentBelowCalMin }),
        },
        'sep',
        { label: 'Remove Volume', disabled: !volume, run: () => nv.removeVolume(selVolume()) },
      ],
    },
    {
      label: 'Mesh',
      items: [
        {
          label: 'Shader',
          disabled: !mesh,
          items: nv.meshShaders.map((s) =>
            radio(s, mesh?.shaderType === s, () => nv.setMesh(meshI, { shaderType: s })),
          ),
        },
        {
          label: 'Background Mesh X-ray',
          checked: nv.meshXRay > 0,
          run: () => {
            nv.meshXRay = nv.meshXRay > 0 ? 0 : 0.1
          },
        },
        'sep',
        { label: 'Remove Mesh', disabled: !mesh, run: () => nv.removeMesh(meshI) },
      ],
    },
    {
      label: 'Color',
      items: [
        {
          label: 'Background Color…',
          run: () =>
            pickColor(nv.backgroundColor, ([r, g, b]) => {
              nv.backgroundColor = [r, g, b, 1]
            }),
        },
        {
          label: 'Colormap',
          disabled: !cmap.set,
          items: nv.colormaps.map((c) =>
            radio(c, c.toLowerCase() === cmap.value?.toLowerCase(), () => cmap.set?.(c)),
          ),
        },
      ],
    },
    ...(app.extraMenus ?? []),
    {
      label: 'Help',
      items: [
        {
          label: 'NiiVue Documentation',
          run: () => open('https://niivue.github.io/mono/', '_blank', 'noopener'),
        },
        ...(app.helpMenu ?? []),
        ...(app.reloadToUpdate
          ? ['sep' as const, { label: 'Reload to Update', run: app.reloadToUpdate }]
          : []),
      ],
    },
  ]
}

/** Flattened items with shortcuts, for the global key handler. */
export function shortcutItems(list = menus().flatMap((m) => m.items)): Exclude<Item, 'sep'>[] {
  return list.flatMap((i) =>
    i === 'sep' ? [] : [...(i.shortcut && !i.local ? [i] : []), ...shortcutItems(i.items ?? [])],
  )
}
