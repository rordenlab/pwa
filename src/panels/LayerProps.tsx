import { nv, useNv } from '../nv'
import { app } from '../state'
import { Check, Choice, Color, ColorbarCheck, NumberField, Range } from './fields'

// NiiVue colormapType 0..2, worded as in NiiVue's vox.stats example.
const RANGES = ['Restrict to range', 'From 0, transparent below', 'From 0, translucent below']

/** Properties of the selected layer; adapts to its kind (plan §4). */
export function LayerProps() {
  const sel = useNv(() => app.selection)
  const colormaps = nv.colormaps
  if (!sel) return null

  if ('volume' in sel) {
    const i = sel.volume
    const v = nv.volumes[i]
    if (!v) return null
    const set = (u: Parameters<typeof nv.setVolume>[1]) => nv.setVolume(i, u)
    const label = !!v.colormapLabel
    return (
      <div className="props">
        {/* An atlas takes its colors from its label table: color controls would do nothing. */}
        {label ? (
          <p className="note">Atlas: each region has its own color.</p>
        ) : (
          <>
            <Choice
              label="Colormap"
              value={v.colormap ?? 'gray'}
              options={colormaps}
              onChange={(colormap) => set({ colormap })}
            />
            <Choice
              label="Negative"
              value={v.colormapNegative ?? ''}
              options={['', ...colormaps]}
              onChange={(colormapNegative) => set({ colormapNegative })}
            />
            <NumberField label="Darkest" value={v.calMin} onChange={(calMin) => set({ calMin })} />
            <NumberField label="Brightest" value={v.calMax} onChange={(calMax) => set({ calMax })} />
            {v.colormapNegative && (
              <>
                <NumberField
                  label="Neg. darkest"
                  value={v.calMinNeg ?? Number.NaN}
                  onChange={(calMinNeg) => set({ calMinNeg })}
                />
                <NumberField
                  label="Neg. brightest"
                  value={v.calMaxNeg ?? Number.NaN}
                  onChange={(calMaxNeg) => set({ calMaxNeg })}
                />
              </>
            )}
          </>
        )}
        <Range label="Opacity" value={v.opacity ?? 1} onChange={(opacity) => set({ opacity })} />
        {!label && (
          <>
            <Choice
              label="Range"
              value={RANGES[v.colormapType ?? 0]}
              options={RANGES}
              onChange={(r) => set({ colormapType: RANGES.indexOf(r) })}
              hint="Restrict: colors span darkest..brightest; values outside are hidden. From 0: the colorbar starts at zero and values below darkest are transparent or faintly translucent (statistical maps)."
            />
            <ColorbarCheck
              value={v.isColorbarVisible}
              onChange={(isColorbarVisible) => set({ isColorbarVisible })}
            />
            <Check
              label="Invert colormap"
              value={!!v.isColormapInverted}
              onChange={(isColormapInverted) => set({ isColormapInverted })}
              hint="Reverse the positive and negative colormaps"
            />
            {i > 0 && (
              <Range
                label="Outline"
                value={nv.volumeOutlineWidth}
                min={0}
                max={1}
                step={0.25}
                onChange={(w) => {
                  nv.volumeOutlineWidth = w
                }}
                hint="Dark border around thresholded clusters. Applies to all overlays."
              />
            )}
          </>
        )}
        <Choice
          label="Interpolation"
          // Unset means core's default: nearest for label data (intent 1002 or a label colormap).
          value={(v.isNearestInterpolation ?? (label || v.hdr?.intent_code === 1002)) ? 'Nearest' : 'Linear'}
          options={['Linear', 'Nearest']}
          onChange={(m) => set({ isNearestInterpolation: m === 'Nearest' })}
          hint="Nearest shows each voxel as a block; Linear blends neighboring voxels. Applies to 2D slices. Overlay threshold edges follow the voxel grid either way, because colors are assigned per voxel before blending."
        />
        {(v.nFrame4D ?? 1) > 1 && (
          <Range
            label={`Frame ${(v.frame4D ?? 0) + 1}/${v.nFrame4D}`}
            value={v.frame4D ?? 0}
            min={0}
            max={(v.nFrame4D ?? 1) - 1}
            step={1}
            onChange={(frame4D) => set({ frame4D })}
          />
        )}
      </div>
    )
  }

  const m = nv.meshes[sel.mesh]
  if (!m) return null
  if (sel.layer !== undefined) return null // shown in the Mesh layers section

  const set = (u: Parameters<typeof nv.setMesh>[1]) => nv.setMesh(sel.mesh, u)
  return (
    <div className="props">
      {m.kind === 'mesh' && (
        <>
          <Choice
            label="Shader"
            value={m.shaderType}
            options={nv.meshShaders}
            onChange={(shaderType) => set({ shaderType })}
          />
          <Color
            label="Color"
            value={m.color}
            onChange={([r, g, b]) => set({ color: [r, g, b, m.color[3]] })}
          />
        </>
      )}
      <Range label="Opacity" value={m.opacity} onChange={(opacity) => set({ opacity })} />
    </div>
  )
}
