import type NiiVue from '@niivue/niivue/webgl2'
import { MULTIPLANAR_TYPE, SLICE_TYPE, type VOLUME_RENDER_MODE } from '@niivue/niivue/webgl2'
import { Tooltip } from 'radix-ui'
import { type ReactNode, useState } from 'react'
import { markChanged } from '../doc'
import { VIEWS } from '../menu/menus'
import { bump, MATCAPS, nv, useNv } from '../nv'
import { app, select, selectedMesh } from '../state'
import { Check, Choice, Color, Field, NumberField, Range } from './fields'
import { ColorbarIcon, MeshIcon, MeshLayerIcon } from './icons'
import { LayerProps } from './LayerProps'
import { Layers } from './Layers'

// Left-panel sections and when each applies (plan §4).

/** onChange handler that assigns a NiiVue property (core emits `change`, so panels re-render). */
const bind =
  <K extends keyof NiiVue>(k: K) =>
  (v: NiiVue[K]) => {
    nv[k] = v
  }
// Multiplanar includes a 3D render tile, so 3D controls apply there too.
const has3D = () =>
  !nv.mosaicString && (nv.sliceType === SLICE_TYPE.RENDER || nv.sliceType === SLICE_TYPE.MULTIPLANAR)
const is2D = () => nv.sliceType !== SLICE_TYPE.RENDER && !nv.mosaicString && nv.volumes.length > 0
const kinds = (k: string) => nv.meshes.some((m) => m.kind === k)
const firstOf = (k: string) => nv.meshes.findIndex((m) => m.kind === k)
/** The selected mesh if it is of this kind, else the first one. */
const selectedOf = (k: string) => {
  const s = selectedMesh()
  return s !== undefined && nv.meshes[s]?.kind === k ? s : firstOf(k)
}

// --- Clip planes -----------------------------------------------------------
const CLIP_OFF = 1.9 // core parks unused planes at depth ±2
const PRESETS: Record<string, number[][]> = {
  None: [],
  'One plane': [[0.1, 180, 20]],
  Slab: [
    [0.1, 180, 20],
    [0.1, 0, -20],
  ],
  'Cutout box': [
    [0, 90, 0],
    [0, 180, 0],
    [0, 0, -90],
  ],
  Box: [
    [0.4, 270, 0],
    [0.4, 90, 0],
    [0.4, 180, 0],
    [0.2, 0, 0],
    [0.1, 0, -90],
  ],
}
const planes = () =>
  [0, 1, 2, 3, 4, 5].map((i) => nv.getClipPlaneDepthAziElev(i)).filter((p) => Math.abs(p[0]) < CLIP_OFF)
function setPlanes(p: number[][]) {
  nv.setClipPlanes(p)
  markChanged() // setClipPlanes emits no event
}
const CLIP_COLOR = { Hidden: 0, Translucent: 0.3, Shaded: -0.2 } as const

function ClipPanel() {
  const list = useNv(planes)
  const cutaway = useNv((n) => n.isClipPlaneCutaway)
  const overlay = useNv((n) => n.clipPlaneOverlay)
  const color = useNv((n) => n.clipPlaneColor)
  const mode = (Object.entries(CLIP_COLOR).find(([, a]) => Math.abs(a - color[3]) < 0.01)?.[0] ??
    'Translucent') as keyof typeof CLIP_COLOR
  const update = (i: number, k: number, v: number) =>
    setPlanes(list.map((p, j) => (j === i ? p.map((x, m) => (m === k ? v : x)) : p)))
  return (
    <>
      <Choice
        label="Preset"
        value=""
        options={['', ...Object.keys(PRESETS)]}
        onChange={(k) => k && setPlanes(PRESETS[k])}
      />
      {list.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: planes are positional in core
        <fieldset key={i} className="plane">
          <legend>
            Plane {i + 1}{' '}
            <button type="button" className="link" onClick={() => setPlanes(list.filter((_, j) => j !== i))}>
              remove
            </button>
          </legend>
          <Range label="Depth" value={p[0]} min={-1} max={1} onChange={(v) => update(i, 0, v)} />
          <Range label="Azimuth" value={p[1]} min={0} max={360} step={1} onChange={(v) => update(i, 1, v)} />
          <Range
            label="Elevation"
            value={p[2]}
            min={-90}
            max={90}
            step={1}
            onChange={(v) => update(i, 2, v)}
          />
        </fieldset>
      ))}
      {list.length < 6 && (
        <button type="button" onClick={() => setPlanes([...list, [0, 180, 0]])}>
          Add plane
        </button>
      )}
      <Check
        label="Cutaway (remove where planes overlap)"
        value={cutaway}
        onChange={bind('isClipPlaneCutaway')}
      />
      <Check label="Clip overlays" value={overlay} onChange={bind('clipPlaneOverlay')} />
      <Choice
        label="Show plane"
        value={mode}
        options={Object.keys(CLIP_COLOR)}
        onChange={(k) => {
          nv.clipPlaneColor = [color[0], color[1], color[2], CLIP_COLOR[k as keyof typeof CLIP_COLOR]]
        }}
      />
      {nv.meshes.length > 0 && (
        <p className="note">Clip planes cut volumes; this NiiVue release does not clip meshes.</p>
      )}
    </>
  )
}

// --- Render ----------------------------------------------------------------
const MODES = ['Composite', 'MIP', 'Slices']
const MIN_LIGHT = 0.05 // below this, matcap shading is treated as off
let lastLight = 0.2 // strength restored when a matcap is chosen again
function RenderPanel() {
  const s = useNv((n) => ({
    mode: n.volumeRenderMode,
    matcap: n.volumeMatcap,
    illum: n.volumeIllumination,
    grad: n.volumeGradientOpacity,
    sil: n.volumeSilhouette,
    rate: n.volumeSampleRate,
    gamma: n.gamma,
  }))
  // Illumination is the strength of matcap shading, so "(none)" simply means illumination 0:
  // one source of truth, which scripts setting volumeIllumination also follow.
  const lit = s.illum >= MIN_LIGHT
  const matcap = lit ? (Object.keys(MATCAPS).find((k) => MATCAPS[k] === s.matcap) ?? '') : ''
  return (
    <>
      <Choice
        label="Mode"
        value={MODES[s.mode] ?? 'Composite'}
        options={MODES}
        onChange={(m) => {
          nv.volumeRenderMode = MODES.indexOf(m) as VOLUME_RENDER_MODE
        }}
      />
      <Choice
        label="MatCap"
        value={matcap}
        options={['', ...Object.keys(MATCAPS)]}
        onChange={(m) => {
          if (!m) {
            if (lit) lastLight = s.illum
            nv.volumeIllumination = 0
            return
          }
          if (!lit) nv.volumeIllumination = lastLight // turning lighting on restores the last strength
          nv.loadMatcap(m).then(markChanged)
        }}
      />
      {/* Off only via "(none)": dragging to 0 would disable the slider mid-drag. */}
      <Range
        label="Illumination"
        value={lit ? s.illum : 0}
        min={lit ? MIN_LIGHT : 0}
        disabled={!lit}
        onChange={bind('volumeIllumination')}
      />
      <Range label="Gradient opacity" value={s.grad} onChange={bind('volumeGradientOpacity')} />
      <Range label="Silhouette" value={s.sil} onChange={bind('volumeSilhouette')} />
      <Range label="Quality" value={s.rate} min={1} max={4} step={0.5} onChange={bind('volumeSampleRate')} />
      <Range label="Gamma" value={s.gamma} min={0.2} max={3} step={0.05} onChange={bind('gamma')} />
    </>
  )
}

// --- Mesh shading ----------------------------------------------------------
function MeshPanel() {
  const i = useNv(() => selectedOf('mesh'))
  const m = useNv(() => nv.meshes[i])
  const xray = useNv((n) => n.meshXRay)
  if (!m) return null
  return (
    <>
      <Field label="Mesh">
        <span className="value">{m.name}</span>
      </Field>
      <Choice
        label="Shader"
        value={m.shaderType}
        options={nv.meshShaders}
        onChange={(shaderType) => nv.setMesh(i, { shaderType })}
      />
      <Color
        label="Color"
        value={m.color}
        onChange={([r, g, b]) => nv.setMesh(i, { color: [r, g, b, m.color[3]] })}
      />
      <Range label="Opacity" value={m.opacity} onChange={(opacity) => nv.setMesh(i, { opacity })} />
      <Range label="X-ray" value={xray} onChange={bind('meshXRay')} />
    </>
  )
}

// --- Mesh layers -----------------------------------------------------------
/**
 * Per-vertex overlays (Surfice's Overlays panel). The picker follows the tree selection: a selected
 * layer, else the first layer of the selected mesh, else the first layer anywhere. A layer can have
 * a positive and a negative colormap, each with its own darkest/brightest.
 */
function MeshLayersPanel() {
  const all = useNv(() =>
    nv.meshes.flatMap((m, mi) =>
      m.layers.map((l, li) => ({ mi, li, label: `${m.name} › ${l.name ?? `layer ${li + 1}`}` })),
    ),
  )
  const sel = useNv(() => app.selection)
  const inMesh = sel && 'mesh' in sel ? all.filter((o) => o.mi === sel.mesh) : []
  const cur = inMesh.find((o) => sel && 'layer' in sel && o.li === sel.layer) ?? inMesh[0] ?? all[0]
  const l = useNv(() => (cur ? nv.meshes[cur.mi]?.layers[cur.li] : undefined))
  if (!cur || !l) return null
  const set = (u: Parameters<typeof nv.setMeshLayerProperty>[2]) => nv.setMeshLayerProperty(cur.mi, cur.li, u)
  return (
    <>
      <Field label="Layer">
        <select
          value={`${cur.mi}:${cur.li}`}
          onChange={(e) => {
            const [mesh, layer] = e.target.value.split(':').map(Number)
            select({ mesh, layer })
          }}
        >
          {all.map((o) => (
            <option key={`${o.mi}:${o.li}`} value={`${o.mi}:${o.li}`}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Choice
        label="Colormap"
        value={l.colormap}
        options={nv.colormaps}
        onChange={(colormap) => set({ colormap })}
      />
      <NumberField label="Darkest" value={l.calMin} onChange={(calMin) => set({ calMin })} />
      <NumberField label="Brightest" value={l.calMax} onChange={(calMax) => set({ calMax })} />
      <Choice
        label="Negative"
        value={l.colormapNegative}
        options={['', ...nv.colormaps]}
        onChange={(colormapNegative) => set({ colormapNegative })}
      />
      {l.colormapNegative && (
        <>
          <NumberField
            label="Neg. darkest"
            value={l.calMinNeg}
            onChange={(calMinNeg) => set({ calMinNeg })}
          />
          <NumberField
            label="Neg. brightest"
            value={l.calMaxNeg}
            onChange={(calMaxNeg) => set({ calMaxNeg })}
          />
        </>
      )}
      <Range label="Opacity" value={l.opacity} onChange={(opacity) => set({ opacity })} />
      <Range
        label="Outline"
        value={l.outlineWidth}
        min={0}
        max={5}
        step={0.5}
        onChange={(outlineWidth) => set({ outlineWidth })}
      />
    </>
  )
}

// --- Slices ----------------------------------------------------------------
let location: number[] = [0, 0, 0]
nv.addEventListener('locationChange', (e) => {
  location = e.detail.mm
})
function SlicePanel() {
  const mm = useNv(() => location)
  const s = useNv((n) => ({
    layout: n.multiplanarType,
    radio: n.isRadiological,
    width: n.crosshairWidth,
    color: n.crosshairColor,
    ruler: n.isRulerVisible,
  }))
  const setMM = (axis: number, v: number) =>
    nv.setCrosshairPos(mm.map((x, i) => (i === axis ? v : x)) as [number, number, number])
  return (
    <>
      <div className="buttons start">
        {Object.entries(VIEWS).map(([name, [, , key, step]]) => (
          <button
            key={key}
            type="button"
            title={`Step one voxel ${name.toLowerCase()}`}
            onClick={() => nv.moveCrosshairInVox(step[0], step[1], step[2])}
          >
            {key}
          </button>
        ))}
      </div>
      {['X', 'Y', 'Z'].map((axis, i) => (
        <NumberField key={axis} label={`${axis} (mm)`} value={mm[i] ?? 0} onChange={(v) => setMM(i, v)} />
      ))}
      <Choice
        label="Multiplanar"
        value={MULTIPLANAR_TYPE[s.layout as 0] ?? 'AUTO'}
        options={['AUTO', 'COLUMN', 'GRID', 'ROW']}
        onChange={(k) => {
          nv.multiplanarType = MULTIPLANAR_TYPE[k as 'AUTO']
        }}
      />
      <Check label="Radiological" value={s.radio} onChange={bind('isRadiological')} />
      <Check label="Ruler" value={s.ruler} onChange={bind('isRulerVisible')} />
      <Range label="Crosshair" value={s.width} min={0} max={5} step={0.5} onChange={bind('crosshairWidth')} />
      <Color
        label="Crosshair color"
        value={s.color}
        onChange={([r, g, b]) => {
          nv.crosshairColor = [r, g, b, s.color[3] ?? 1]
        }}
      />
    </>
  )
}

// --- Mosaic ----------------------------------------------------------------
/** Evenly spaced slices across the background volume for one orientation. */
function mosaicString(orient: 'A' | 'C' | 'S', cols: number, rows: number): string {
  const v = nv.volumes[0]
  const axis = { S: 0, C: 1, A: 2 }[orient]
  const lo = v ? v.extentsMin[axis] : -50
  const hi = v ? v.extentsMax[axis] : 50
  const n = cols * rows
  const mm = Array.from({ length: n }, (_, i) => Math.round(lo + ((i + 1) * (hi - lo)) / (n + 1)))
  const lines = Array.from({ length: rows }, (_, r) => mm.slice(r * cols, (r + 1) * cols).join(' '))
  return `${orient} ${lines.join(' ; ')}`
}
function MosaicPanel() {
  const str = useNv((n) => n.mosaicString)
  const [cfg, setCfg] = useState({ orient: 'A' as 'A' | 'C' | 'S', cols: 4, rows: 2 })
  const apply = (c: typeof cfg) => {
    setCfg(c)
    nv.mosaicString = mosaicString(c.orient, c.cols, c.rows)
  }
  return (
    <>
      <Choice
        label="Orientation"
        value={cfg.orient}
        options={['A', 'C', 'S']}
        onChange={(o) => apply({ ...cfg, orient: o as 'A' })}
      />
      <Range
        label={`Columns ${cfg.cols}`}
        value={cfg.cols}
        min={1}
        max={10}
        step={1}
        onChange={(cols) => apply({ ...cfg, cols })}
      />
      <Range
        label={`Rows ${cfg.rows}`}
        value={cfg.rows}
        min={1}
        max={6}
        step={1}
        onChange={(rows) => apply({ ...cfg, rows })}
      />
      <Field label="String">
        <textarea
          className="mosaic"
          value={str}
          onChange={(e) => {
            nv.mosaicString = e.target.value
          }}
          rows={3}
        />
      </Field>
    </>
  )
}

// --- Tracts and connectomes ------------------------------------------------
function TractPanel() {
  const i = useNv(() => selectedOf('tract'))
  const o = useNv(() => nv.meshes[i]?.tractOptions)
  const trx = nv.meshes[i]?.trx
  if (!o) return null
  const scalars = [
    ...Object.keys(trx?.dpv ?? {}).map((k) => `dpv:${k}`),
    ...Object.keys(trx?.dps ?? {}).map((k) => `dps:${k}`),
  ]
  const set = (u: Parameters<typeof nv.setTractOptions>[1]) => nv.setTractOptions(i, u)
  const colorBy = { '': 'direction', global: 'start → end', fixed: 'fixed color' } as Record<string, string>
  return (
    <>
      <Range
        label="Min length"
        value={o.minLength}
        min={0}
        max={100}
        step={1}
        onChange={(minLength) => set({ minLength })}
      />
      <Range
        label="Width"
        value={o.fiberRadius}
        min={0.1}
        max={3}
        step={0.1}
        onChange={(fiberRadius) => set({ fiberRadius })}
      />
      <Range
        label="Decimate"
        value={o.decimation}
        min={1}
        max={10}
        step={1}
        onChange={(decimation) => set({ decimation })}
      />
      <Choice
        label="Color by"
        value={colorBy[o.colorBy] ?? o.colorBy}
        options={[...Object.values(colorBy), ...scalars]}
        onChange={(c) => set({ colorBy: Object.keys(colorBy).find((k) => colorBy[k] === c) ?? c })}
      />
      {o.colorBy.includes(':') && (
        <Choice
          label="Colormap"
          value={o.colormap}
          options={nv.colormaps}
          onChange={(colormap) => set({ colormap })}
        />
      )}
    </>
  )
}

function ConnectomePanel() {
  const i = useNv(() => selectedOf('connectome'))
  const o = useNv(() => nv.meshes[i]?.connectomeOptions)
  if (!o) return null
  const set = (u: Parameters<typeof nv.setConnectomeOptions>[1]) => nv.setConnectomeOptions(i, u)
  return (
    <>
      <Choice
        label="Node colors"
        value={o.nodeColormap}
        options={nv.colormaps}
        onChange={(nodeColormap) => set({ nodeColormap })}
      />
      <Range
        label="Node size"
        value={o.nodeScale}
        min={0}
        max={10}
        step={0.5}
        onChange={(nodeScale) => set({ nodeScale })}
      />
      <Choice
        label="Edge colors"
        value={o.edgeColormap}
        options={nv.colormaps}
        onChange={(edgeColormap) => set({ edgeColormap })}
      />
      <Range
        label="Edge size"
        value={o.edgeScale}
        min={0}
        max={5}
        step={0.25}
        onChange={(edgeScale) => set({ edgeScale })}
      />
      <NumberField label="Edge min" value={o.edgeMin} onChange={(edgeMin) => set({ edgeMin })} />
      <NumberField label="Edge max" value={o.edgeMax} onChange={(edgeMax) => set({ edgeMax })} />
    </>
  )
}

function ColorbarPanel() {
  const s = useNv((n) => ({ bar: n.isColorbarVisible, legend: n.isLegendVisible }))
  return (
    <>
      <Check label="Colorbar" value={s.bar} onChange={bind('isColorbarVisible')} />
      <Check label="Legend (labels, connectome nodes)" value={s.legend} onChange={bind('isLegendVisible')} />
    </>
  )
}

type Section = { id: string; icon: ReactNode; title: string; when: () => boolean; body: () => ReactNode }
const SECTIONS: Section[] = [
  { id: 'layers', icon: '☰', title: 'Layers', when: () => true, body: () => <Layers /> },
  {
    id: 'props',
    icon: '◐',
    title: 'Layer properties',
    // Mesh-layer selections are edited in the Mesh layers section.
    when: () => app.selection !== null && !('layer' in app.selection && app.selection.layer !== undefined),
    body: () => <LayerProps />,
  },
  {
    id: 'clip',
    icon: '✂',
    title: 'Clip planes',
    when: () => has3D() && nv.volumes.length > 0,
    body: () => <ClipPanel />,
  },
  {
    id: 'render',
    icon: '◍',
    title: 'Render',
    when: () => has3D() && nv.volumes.length > 0,
    body: () => <RenderPanel />,
  },
  {
    id: 'mesh',
    icon: <MeshIcon />,
    title: 'Mesh shading',
    when: () => kinds('mesh'),
    body: () => <MeshPanel />,
  },
  {
    id: 'meshlayers',
    icon: <MeshLayerIcon />,
    title: 'Mesh layers',
    when: () => nv.meshes.some((m) => m.layers.length > 0),
    body: () => <MeshLayersPanel />,
  },
  { id: 'slices', icon: '⊞', title: 'Slices', when: is2D, body: () => <SlicePanel /> },
  { id: 'mosaic', icon: '▦', title: 'Mosaic', when: () => !!nv.mosaicString, body: () => <MosaicPanel /> },
  { id: 'tracts', icon: '⟿', title: 'Tracts', when: () => kinds('tract'), body: () => <TractPanel /> },
  {
    id: 'connectome',
    icon: '⊙',
    title: 'Connectome',
    when: () => kinds('connectome'),
    body: () => <ConnectomePanel />,
  },
  {
    id: 'colorbar',
    icon: <ColorbarIcon />,
    title: 'Colorbar',
    when: () =>
      nv.volumes.length > 0 || nv.meshes.some((m) => m.layers.length > 0 || m.kind === 'connectome'),
    body: () => <ColorbarPanel />,
  },
]

// Unpinned sections are a per-viewer convenience: localStorage, guarded (plan §6).
const KEY = 'niivue-pwa:unpinned'
const unpinned = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]')
    } catch {
      return []
    }
  })(),
)
function togglePin(id: string) {
  if (!unpinned.delete(id)) unpinned.add(id)
  try {
    localStorage.setItem(KEY, JSON.stringify([...unpinned]))
  } catch {}
  bump()
}

export function ToolPanel() {
  const state = useNv(() => SECTIONS.map((s) => ({ ...s, on: s.when(), pinned: !unpinned.has(s.id) })))
  return (
    <div className="toolpanel">
      <Tooltip.Provider delayDuration={200} disableHoverableContent>
        <nav className="strip" aria-label="Tool sections">
          {state.map((s) => (
            <Tooltip.Root key={s.id}>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  aria-label={s.title}
                  aria-pressed={s.pinned}
                  // Three states: shown (accent), hidden (normal), not used in this view (gray, inert).
                  // aria-disabled rather than disabled, so the tooltip still explains why.
                  data-state={!s.on ? 'unused' : s.pinned ? 'shown' : 'hidden'}
                  aria-disabled={!s.on}
                  onClick={() => s.on && togglePin(s.id)}
                >
                  {s.icon}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="tooltip" side="right" sideOffset={6}>
                  <strong>{s.title}</strong>
                  <span>
                    {!s.on ? 'Not used in this view' : s.pinned ? 'Click to hide' : 'Hidden — click to show'}
                  </span>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </nav>
      </Tooltip.Provider>
      <div className="sections">
        {state
          .filter((s) => s.on && s.pinned)
          .map((s) => (
            <details key={s.id} open className="section" data-section={s.id}>
              <summary>{s.title}</summary>
              <div className="props">{s.body()}</div>
            </details>
          ))}
      </div>
    </div>
  )
}
