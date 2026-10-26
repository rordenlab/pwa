import { OVERLAY_ALPHA_BLEND, OVERLAY_COLOR_BLEND } from '@niivue/niivue/webgl2'
import { ContextMenu, Dialog } from 'radix-ui'
import { type DragEvent, Fragment, type ReactNode, useState } from 'react'
import { isLayerVisible, moveMeshLayer, moveVolumeTo, rename, setLayerVisible } from '../layers'
import { nv, useNv } from '../nv'
import { app, type Selection, select } from '../state'
import { MeshIcon } from './icons'

type Row = {
  key: string
  sel: Selection
  depth: number
  icon: ReactNode
  kind: string
  name: string
  visible: boolean
  setVisible: (v: boolean) => void
  obj: { name?: string }
  /** Reorder group: rows sharing a group can be dragged among each other. */
  group?: string
  index: number
  count: number
  move?: (to: number) => unknown
  remove: () => void
  invert?: () => void
  reset?: () => void
  header?: () => unknown
}

// Rows are keyed by object, not position: an open rename field, context menu or drag stays with its
// layer when scripts, drops or other panels add, remove or reorder layers.
const ids = new WeakMap<object, string>()
let nextId = 0
const idOf = (o: object) => {
  if (!ids.has(o)) ids.set(o, `L${nextId++}`)
  return ids.get(o) as string
}

const ICON = { mesh: <MeshIcon size={13} />, tract: '⟿', connectome: '⊙' } as const

function rows(): Row[] {
  const out: Row[] = []
  const nVol = nv.volumes.length
  nv.volumes.forEach((v, i) => {
    out.push({
      key: idOf(v),
      sel: { volume: i },
      depth: i === 0 ? 0 : 1,
      icon: i === 0 ? '◼' : '◻',
      kind: i === 0 ? 'background volume' : 'overlay volume',
      name: v.name,
      visible: v.visible !== false,
      setVisible: (visible) => nv.setVolume(i, { visible }),
      obj: v,
      group: 'volumes',
      index: i,
      count: nVol,
      move: (to) => moveVolumeTo(v, to),
      remove: () => nv.removeVolume(i),
      invert: () => nv.setVolume(i, { isColormapInverted: !v.isColormapInverted }),
      reset: () => nv.setVolume(i, { calMin: v.robustMin, calMax: v.robustMax }),
      header: () => ({ header: v.hdr, sidecar: app.sidecars.get(v) }),
    })
  })
  nv.meshes.forEach((m, mi) => {
    out.push({
      key: idOf(m),
      sel: { mesh: mi },
      depth: 0,
      icon: ICON[m.kind],
      kind: m.kind,
      name: m.name ?? `mesh ${mi + 1}`,
      visible: m.visible !== false,
      setVisible: (visible) => nv.setMesh(mi, { visible }),
      obj: m,
      index: mi,
      count: nv.meshes.length,
      remove: () => nv.removeMesh(mi),
    })
    m.layers.forEach((l, li) => {
      out.push({
        key: idOf(l),
        sel: { mesh: mi, layer: li },
        depth: 1,
        icon: '◇',
        kind: 'mesh layer',
        name: l.name ?? `layer ${li + 1}`,
        visible: isLayerVisible(l),
        setVisible: (v) => setLayerVisible(mi, li, v),
        obj: l,
        group: idOf(m),
        index: li,
        count: m.layers.length,
        move: (to) => moveMeshLayer(mi, li, to), // synchronous splice: indices are current
        remove: () => nv.removeMeshLayer(mi, li),
        invert: () => nv.setMeshLayerProperty(mi, li, { isColormapInverted: !l.isColormapInverted }),
        reset: () => nv.setMeshLayerProperty(mi, li, { calMin: l.globalMin, calMax: l.globalMax }),
      })
    })
  })
  return out
}

/** Move a row and keep it selected; the selection follows the object, so it stays right across awaits. */
function moveTo(r: Row, to: number) {
  select(r.sel)
  return r.move?.(to)
}

const same = (a: Selection, b: Selection) => JSON.stringify(a) === JSON.stringify(b)
const DRAG = 'application/x-niivue-layer'

export function Layers() {
  const list = useNv(rows)
  const selection = useNv(() => app.selection)
  const [editing, setEditing] = useState('')
  const [header, setHeader] = useState<unknown>(null)
  const [dragKey, setDragKey] = useState('')

  const onDrop = (e: DragEvent, target: Row) => {
    const src = list.find((r) => r.key === e.dataTransfer.getData(DRAG))
    if (!src || src.group !== target.group || !src.move) return
    e.preventDefault()
    e.stopPropagation()
    moveTo(src, target.index)
  }

  if (!list.length) return <p className="empty">Drop volumes or meshes here, or use File ▸ Open.</p>

  return (
    <>
      <div className="tree" role="tree" aria-label="Layers">
        {nv.volumes.length > 0 && <Root label="Volumes" menu={<BlendMenu />} />}
        {list.map((r, i) => (
          <Fragment key={r.key}>
            {r === list.find((x) => x.sel && 'mesh' in x.sel) && <Root label="Meshes" />}
            <ContextMenu.Root>
              <ContextMenu.Trigger asChild>
                <div
                  role="treeitem"
                  aria-selected={same(selection, r.sel)}
                  aria-level={r.depth + 1}
                  title={`${r.name} — ${r.kind}`} // full name: BIDS file names are often truncated
                  className={`row depth${r.depth}${dragKey === r.key ? ' dragging' : ''}`}
                  data-key={r.key}
                  draggable={!!r.group}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG, r.key)
                    setDragKey(r.key)
                  }}
                  onDragEnd={() => setDragKey('')}
                  onDragOver={(e) => e.dataTransfer.types.includes(DRAG) && e.preventDefault()}
                  onDrop={(e) => onDrop(e, r)}
                  onClick={() => select(r.sel)}
                  onDoubleClick={() => setEditing(r.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      const next = list[e.key === 'ArrowDown' ? i + 1 : i - 1]
                      if (next) {
                        select(next.sel)
                        // Focus follows selection so repeated arrows and F2 act on the new row.
                        // The next row is already rendered: focus it now, so quick key presses stay in order.
                        document
                          .querySelector<HTMLElement>(`[role=treeitem][data-key="${next.key}"]`)
                          ?.focus()
                      }
                    } else if (e.key === 'F2') setEditing(r.key)
                    else return
                    e.preventDefault()
                  }}
                  tabIndex={same(selection, r.sel) ? 0 : -1}
                >
                  <input
                    type="checkbox"
                    checked={r.visible}
                    aria-label={`Show ${r.name}`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => r.setVisible(e.target.checked)}
                  />
                  <span className="icon" aria-hidden>
                    {r.icon}
                  </span>
                  {editing === r.key ? (
                    <input
                      className="rename"
                      // biome-ignore lint/a11y/noAutofocus: rename field opens on explicit request
                      autoFocus
                      defaultValue={r.name}
                      onFocus={(e) => e.currentTarget.select()} // typing replaces the name, as in Finder
                      onBlur={(e) => {
                        rename(r.obj, e.target.value || r.name)
                        setEditing('')
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setEditing('')
                      }}
                    />
                  ) : (
                    <span className="name">{r.name}</span>
                  )}
                </div>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className="menu" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {r.move && (
                    <>
                      <Item disabled={r.index === 0} onSelect={() => moveTo(r, r.index - 1)}>
                        Move Up
                      </Item>
                      <Item disabled={r.index === r.count - 1} onSelect={() => moveTo(r, r.index + 1)}>
                        Move Down
                      </Item>
                      <ContextMenu.Separator className="menu-sep" />
                    </>
                  )}
                  <Item onSelect={() => setEditing(r.key)}>Rename</Item>
                  {r.header && <Item onSelect={() => setHeader(r.header?.())}>Show Header</Item>}
                  {r.invert && <Item onSelect={r.invert}>Invert Colormap</Item>}
                  {r.reset && <Item onSelect={r.reset}>Reset Range</Item>}
                  <ContextMenu.Separator className="menu-sep" />
                  <Item
                    onSelect={() => {
                      select(null)
                      r.remove()
                    }}
                  >
                    Remove
                  </Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          </Fragment>
        ))}
      </div>
      <Dialog.Root open={header !== null} onOpenChange={(o) => !o && setHeader(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog">
            <Dialog.Title>Header</Dialog.Title>
            <pre className="header">{header !== null && JSON.stringify(header, replacer, 1)}</pre>
            <Dialog.Close className="button">Close</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

const replacer = (_: string, v: unknown) =>
  ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v

function Item({ children, ...p }: { children: ReactNode; disabled?: boolean; onSelect?: () => void }) {
  return (
    <ContextMenu.Item className="menu-item" {...p}>
      {children}
    </ContextMenu.Item>
  )
}

function Root({ label, menu }: { label: string; menu?: ReactNode }) {
  const li = (
    <div className="root" role="presentation">
      {label}
    </div>
  )
  if (!menu) return li
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{li}</ContextMenu.Trigger>
      <ContextMenu.Portal>{menu}</ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function BlendMenu() {
  const alpha = useNv((n) => n.volumeOverlayAlphaBlend)
  const color = useNv((n) => n.volumeOverlayColorBlend)
  return (
    <ContextMenu.Content className="menu">
      <ContextMenu.Label className="menu-label">Overlay opacity</ContextMenu.Label>
      <ContextMenu.RadioGroup
        value={String(alpha)}
        onValueChange={(v) => {
          nv.volumeOverlayAlphaBlend = Number(v)
        }}
      >
        {(['MAX', 'ADDITIVE', 'OVER'] as const).map((k) => (
          <ContextMenu.RadioItem key={k} className="menu-item" value={String(OVERLAY_ALPHA_BLEND[k])}>
            {k.toLowerCase()}
          </ContextMenu.RadioItem>
        ))}
      </ContextMenu.RadioGroup>
      <ContextMenu.Separator className="menu-sep" />
      <ContextMenu.Label className="menu-label">Overlay color</ContextMenu.Label>
      <ContextMenu.RadioGroup
        value={String(color)}
        onValueChange={(v) => {
          nv.volumeOverlayColorBlend = Number(v)
        }}
      >
        {(['ADDITIVE', 'MEAN', 'OVER', 'MAX'] as const).map((k) => (
          <ContextMenu.RadioItem key={k} className="menu-item" value={String(OVERLAY_COLOR_BLEND[k])}>
            {k.toLowerCase()}
          </ContextMenu.RadioItem>
        ))}
      </ContextMenu.RadioGroup>
    </ContextMenu.Content>
  )
}
