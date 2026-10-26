import { Dialog } from 'radix-ui'
import { useState } from 'react'

let request = 0 // only the latest group change clears the optimistic state

import { markChanged } from '../doc'
import { nv, useNv } from '../nv'
import { fromHex, toHex } from './fields'

type RGBA = [number, number, number, number]

/** Distinct default colors: hues a golden angle apart. */
export function groupColor(k: number): RGBA {
  const h = (k * 137.508) % 360
  const f = (n: number) => {
    const a = (n + h / 30) % 12
    return Math.round(255 * (0.5 - 0.45 * Math.max(-1, Math.min(a - 3, 9 - a, 1))))
  }
  return [f(0), f(8), f(4), 255]
}

/**
 * Tract groups (e.g. TRX bundles). Core shows only the groups listed in `groupColors`, each in its
 * color; `null` shows every streamline colored by `colorBy`. So hiding any group colors by group.
 */
export function TractGroups({ i }: { i: number }) {
  const groups = useNv(() => nv.getTractGroups(i))
  const listed = useNv(() => nv.meshes[i]?.tractOptions?.groupColors ?? null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  // Rebuilding many bundles takes a moment: show the new choice at once.
  const [pending, setPending] = useState<Set<string> | null>(null)
  if (!groups.length) return null

  const shown = pending ?? new Set(listed ? groups.filter((g) => g in listed) : groups)
  // ponytail: a hidden group's custom color is forgotten; keep a per-mesh map if users ask.
  const colorOf = (g: string): RGBA => listed?.[g] ?? groupColor(groups.indexOf(g))
  const apply = (names: Iterable<string>, colors: Record<string, RGBA> = {}) => {
    const next = new Set(names)
    const mine = ++request
    setPending(next)
    nv.setTractOptions(i, {
      groupColors: Object.fromEntries([...next].map((g) => [g, colors[g] ?? colorOf(g)])),
    })
      .then(markChanged) // emits no event
      .finally(() => mine === request && setPending(null))
  }
  const rows = groups.filter((g) => g.toLowerCase().includes(filter.toLowerCase()))
  const rowsShown = rows.filter((g) => shown.has(g)).length
  const setRows = (on: boolean) => apply(groups.filter((g) => (rows.includes(g) ? on : shown.has(g))))

  return (
    <>
      <label className="field">
        <span>Groups</span>
        <button type="button" onClick={() => setOpen(true)}>
          {shown.size}/{groups.length} shown…
        </button>
      </label>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog">
            <Dialog.Title>Tract groups: {nv.meshes[i]?.name}</Dialog.Title>
            <Dialog.Description>
              Hidden groups are not drawn. While any group is hidden, streamlines take their group's color.
            </Dialog.Description>
            <input
              type="search"
              placeholder="Filter groups"
              aria-label="Filter groups"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="group-table">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label={filter ? 'Show all matching groups' : 'Show all groups'}
                        checked={rows.length > 0 && rowsShown === rows.length}
                        ref={(el) => {
                          if (el) el.indeterminate = rowsShown > 0 && rowsShown < rows.length
                        }}
                        onChange={(e) => setRows(e.target.checked)}
                      />
                    </th>
                    <th>Group</th>
                    <th>Color</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => (
                    <tr key={g}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Show ${g}`}
                          checked={shown.has(g)}
                          onChange={(e) =>
                            apply(groups.filter((x) => (x === g ? e.target.checked : shown.has(x))))
                          }
                        />
                      </td>
                      <td>{g}</td>
                      <td>
                        <input
                          type="color"
                          aria-label={`${g} color`}
                          value={toHex(colorOf(g).map((c) => c / 255))}
                          onChange={(e) =>
                            apply(new Set([...shown, g]), {
                              [g]: [...fromHex(e.target.value).map((c) => Math.round(c * 255)), 255] as RGBA,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="buttons">
              <button
                type="button"
                className="button"
                onClick={() => nv.setTractOptions(i, { groupColors: null }).then(markChanged)}
              >
                Show all, original colors
              </button>
              <Dialog.Close className="button primary">Done</Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
