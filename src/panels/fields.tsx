import { type ReactNode, useEffect, useState } from 'react'
import { nv } from '../nv'

// Native inputs (ponytail: platform controls over a widget library).

/** `hint`: tooltip on hover, for settings whose effect is not obvious. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: control is the child
    <label className="field" title={hint}>
      <span>{label}</span>
      {children}
    </label>
  )
}

/** Number box that commits on Enter/blur so partial input like "-" survives typing. */
export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const shown = Number.isFinite(value) ? String(+value.toPrecision(6)) : ''
  const [text, setText] = useState(shown)
  useEffect(() => setText(shown), [shown])
  const commit = () => {
    const v = Number.parseFloat(text)
    if (Number.isFinite(v) && String(v) !== shown) onChange(v)
    else setText(shown)
  }
  return (
    <Field label={label}>
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </Field>
  )
}

export function Range({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  disabled = false,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="range"
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </Field>
  )
}

export function Choice({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      {/* Core colormap lookup is case-insensitive; names list is capitalized. */}
      <select
        value={options.find((o) => o.toLowerCase() === value.toLowerCase()) ?? value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || '(none)'}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Check({
  label,
  value,
  onChange,
  hint,
  disabled = false,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  hint?: string
  disabled?: boolean
}) {
  return (
    // The tooltip sits on the label, so it still shows while the box is disabled.
    <label className="check" title={hint}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

const hex = (c: number) =>
  Math.round(c * 255)
    .toString(16)
    .padStart(2, '0')
export const toHex = (rgb: ArrayLike<number>) => `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`
export const fromHex = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255)

export function Color({
  label,
  value,
  onChange,
}: {
  label: string
  value: ArrayLike<number>
  onChange: (rgb: number[]) => void
}) {
  return (
    <Field label={label}>
      <input type="color" value={toHex(value)} onChange={(e) => onChange(fromHex(e.target.value))} />
    </Field>
  )
}

/** Per-layer colorbar entry; disabled, with a pointer to the global switch, while colorbars are hidden. */
export function ColorbarCheck({ value, onChange }: { value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <Check
      label="Colorbar"
      value={value !== false}
      onChange={onChange}
      disabled={!nv.isColorbarVisible}
      hint={
        nv.isColorbarVisible
          ? 'Include this layer in the colorbar'
          : 'Colorbars are hidden: turn on View ▸ Colorbar to show them'
      }
    />
  )
}
