import { useEffect, useRef } from 'react'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'
import { Dialogs } from './Dialogs'
import { doc, openPicked } from './doc'
import { hasFSA } from './io/fs'
import { matches } from './menu/keys'
import { Menubar, NARROW } from './menu/Menubar'
import { shortcutItems } from './menu/menus'
import { attach, nv, useNv } from './nv'
import { ToolPanel } from './panels/context'
import { pixelRatio, prefs } from './prefs'
import { ScriptPanel } from './script/Script'
import { app } from './state'

const APP = 'MRIvue'

function toggle(p: ReturnType<typeof usePanelRef>, open?: boolean) {
  const h = p.current
  if (!h) return
  ;(open ?? h.isCollapsed()) ? h.expand() : h.collapse()
}

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const tools = usePanelRef()
  const script = usePanelRef()
  // Bump the id when defaults change, so saved layouts from older defaults are not reused.
  const layout = useDefaultLayout({ id: 'main-v2', panelIds: ['tools', 'scene', 'script'] })
  const location = useNv(() => status)
  const message = useNv(() => app.message)
  // "MRIvue" until a scene is opened or saved as a .nvd, then "MRIvue: myScene" (• = unsaved changes).
  const title = useNv(() => {
    const named = doc.handle || doc.name !== 'untitled.nvd'
    return named ? `${APP}: ${doc.name.replace(/\.nvd$/, '')}${doc.dirty ? ' •' : ''}` : APP
  })

  useEffect(() => {
    app.togglePane = (p, open) => toggle(p === 'tools' ? tools : script, open)
  }, [tools, script])

  // Small screens start with the scene only; both panes stay one tap away (☰ ▸ View ▸ Toggle Tools).
  useEffect(() => {
    if (matchMedia(NARROW).matches) {
      tools.current?.collapse()
      script.current?.collapse()
    }
  }, [tools, script])

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    if (canvas.current) attach(canvas.current, { antialias: prefs.antialias, pixelRatio: pixelRatio() })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Plain typing in fields keeps its keys; modified shortcuts still work.
      const t = e.target as HTMLElement
      const editing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
      if (e.defaultPrevented || (editing && !(e.metaKey || e.ctrlKey))) return // e.g. the editor's own ⌘S
      const item = shortcutItems().find((i) => i.shortcut && matches(i.shortcut, e))
      if (!item || item.disabled) return
      e.preventDefault()
      item.run?.()
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const dt = e.dataTransfer
      if (!dt?.files.length) return
      // Request handles synchronously inside the event, before any await (plan §6).
      const files = Array.from(dt.files)
      // dt.items can also hold strings (e.g. text/uri-list); only file items line up with dt.files.
      const fileItems = Array.from(dt.items).filter((i) => i.kind === 'file')
      const handles = fileItems.map((i) =>
        hasFSA ? i.getAsFileSystemHandle?.().catch(() => null) : undefined,
      )
      Promise.all(handles).then((hs) =>
        openPicked(
          files.map((file, k) => ({
            file,
            handle: hs[k]?.kind === 'file' ? (hs[k] as FileSystemFileHandle) : undefined,
          })),
          false,
        ),
      )
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <div className="app">
      <header className="titlebar">
        <Menubar />
      </header>
      <main className="panes">
        <Group orientation="horizontal" className="panes" {...layout}>
          <Panel id="tools" panelRef={tools} collapsible defaultSize={240} minSize={180} className="side">
            <ToolPanel />
          </Panel>
          <Separator className="sep" disableDoubleClick onDoubleClick={() => toggle(tools)} />
          <Panel id="scene" minSize={200} className="scene">
            <canvas ref={canvas} />
          </Panel>
          <Separator className="sep" disableDoubleClick onDoubleClick={() => toggle(script)} />
          <Panel id="script" panelRef={script} collapsible defaultSize="0" minSize={200} className="side">
            <h2>Scripting</h2>
            <ScriptPanel />
          </Panel>
        </Group>
      </main>
      <Dialogs />
      <footer className="status">
        <span className="location">{location}</span>
        <span className="message" role="status">
          {message}
        </span>
      </footer>
    </div>
  )
}

let status = ''
// Show the crosshair readout as soon as data appears, not only after the first click.
for (const e of ['volumeLoaded', 'documentLoaded'] as const)
  nv.addEventListener(e, () => nv.createOnLocationChange())
nv.addEventListener('locationChange', (e) => {
  status = e.detail.string
})
