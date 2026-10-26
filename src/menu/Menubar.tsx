import { Menubar as M } from 'radix-ui'
import { useSyncExternalStore } from 'react'
import { useNv } from '../nv'
import { isMac, label } from './keys'
import { type Item, menus } from './menus'

function Entry({ item }: { item: Item }) {
  if (item === 'sep') return <M.Separator className="menu-sep" />
  if (item.items)
    return (
      <M.Sub>
        <M.SubTrigger className="menu-item" disabled={item.disabled || !item.items.length}>
          {item.label}
          <span aria-hidden>▸</span>
        </M.SubTrigger>
        <M.Portal>
          <M.SubContent className="menu scroll" sideOffset={2}>
            {item.items.map((i, k) => (
              <Entry key={i === 'sep' ? `s${k}` : i.label + k} item={i} />
            ))}
          </M.SubContent>
        </M.Portal>
      </M.Sub>
    )
  const keys = item.shortcut?.replace('Mod', isMac ? 'Meta' : 'Control')
  const body = (
    <>
      {item.label}
      {item.shortcut && (
        <span className="shortcut" aria-hidden>
          {label(item.shortcut)}
        </span>
      )}
    </>
  )
  return item.checked === undefined ? (
    <M.Item
      className="menu-item"
      disabled={item.disabled}
      onSelect={() => item.run?.()}
      aria-keyshortcuts={keys}
    >
      {body}
    </M.Item>
  ) : (
    <M.CheckboxItem
      className="menu-item"
      disabled={item.disabled}
      checked={item.checked}
      onSelect={() => item.run?.()}
    >
      {body}
    </M.CheckboxItem>
  )
}

/** Phones and narrow windows: the eight menus don't fit across (~400px). */
export const NARROW = '(max-width: 600px)'

function useNarrow() {
  return useSyncExternalStore(
    (f) => {
      const q = matchMedia(NARROW)
      q.addEventListener('change', f)
      return () => q.removeEventListener('change', f)
    },
    () => matchMedia(NARROW).matches,
  )
}

export function Menubar() {
  const list = useNv(menus)
  const narrow = useNarrow()
  if (narrow)
    // One ☰ menu with the same menus as submenus.
    return (
      <M.Root className="menubar">
        <M.Menu>
          <M.Trigger className="menubar-trigger" aria-label="Menu">
            ☰
          </M.Trigger>
          <M.Portal>
            <M.Content className="menu" align="start" sideOffset={2}>
              {list.map((m) => (
                <Entry key={m.label} item={{ label: m.label, items: m.items }} />
              ))}
            </M.Content>
          </M.Portal>
        </M.Menu>
      </M.Root>
    )
  return (
    <M.Root className="menubar">
      {list.map((m) => (
        <M.Menu key={m.label}>
          <M.Trigger className="menubar-trigger">{m.label}</M.Trigger>
          <M.Portal>
            <M.Content className="menu" align="start" sideOffset={2}>
              {m.items.map((i, k) => (
                <Entry key={i === 'sep' ? `s${k}` : i.label} item={i} />
              ))}
            </M.Content>
          </M.Portal>
        </M.Menu>
      ))}
    </M.Root>
  )
}
