import { nv, useNv } from '../nv'
import { app } from '../state'
import { Choice, Color, NumberField, Range } from './fields'

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
    return (
      <div className="props">
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
        <Range label="Opacity" value={v.opacity ?? 1} onChange={(opacity) => set({ opacity })} />
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
