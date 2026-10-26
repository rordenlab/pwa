import { javascript } from '@codemirror/lang-javascript'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { basicSetup, EditorView } from 'codemirror'
import { Dialog } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { download, pickFiles, pickSave, write } from '../io/fs'
import { bump, useNv } from '../nv'
import { app, notify } from '../state'
import { isRunning, type Line, locator, run, stop } from './run'
import { snippets, templates } from './templates'

const MAX_LINES = 500

export const script = {
  name: 'untitled.js',
  handle: undefined as FileSystemFileHandle | undefined,
  dirty: false,
  /** Bumped per edit; saves only clear dirty if no edit happened meanwhile. */
  revision: 0,
  /** Bumped when the editor is loaded with a different script. */
  id: 0,
  output: [] as Line[],
  view: undefined as EditorView | undefined,
}
addEventListener('beforeunload', (e) => {
  if (script.dirty) e.preventDefault()
})

const text = () => script.view?.state.doc.toString() ?? ''
// Replacing the whole script (New/Open/Templates) is not an edit: dirty is reset right after.
function setText(t: string, name: string, handle?: FileSystemFileHandle) {
  script.view?.dispatch({ changes: { from: 0, to: script.view.state.doc.length, insert: t } })
  Object.assign(script, { name, handle, dirty: false, id: script.id + 1 })
  app.togglePane?.('script', true)
  bump()
}
const okToReplace = () => !script.dirty || confirm('Discard changes to the current script?')

function emit(l: Line) {
  script.output.push(l)
  if (script.output.length > MAX_LINES) script.output.splice(0, script.output.length - MAX_LINES)
  bump()
}

async function runScript() {
  if (isRunning()) return
  script.output = []
  app.togglePane?.('script', true)
  bump()
  const done = run(text(), emit)
  bump()
  await done
  bump()
}

function openScriptFile(f: File, handle?: FileSystemFileHandle) {
  if (!okToReplace()) return
  f.text().then((t) => setText(t, f.name, handle))
}

// Script writes complete in request order, so an older save can never land after a newer one.
let scriptWrites: Promise<unknown> = Promise.resolve()

async function saveScript(as = false) {
  const { id, revision, handle: current, name } = script
  const blob = new Blob([text()], { type: 'text/javascript' })
  try {
    const target = !as && current ? current : await pickSave(name)
    if (target === undefined) return // cancelled
    const done = scriptWrites.then(() => (target ? write(target, blob) : download(name, blob)))
    scriptWrites = done.catch(() => {})
    await done
    if (script.id !== id) return // another script was loaded meanwhile
    if (target && target !== current) Object.assign(script, { handle: target, name: target.name })
    if (script.revision === revision) script.dirty = false
    bump()
  } catch (e) {
    notify(`Save failed: ${(e as Error).message}`)
  }
}

function insert(text: string) {
  const v = script.view
  if (!v) return
  app.togglePane?.('script', true)
  v.dispatch(v.state.replaceSelection(text))
  v.focus()
}

app.openScript = (f) => openScriptFile(f)
app.insertScript = insert
app.extraMenus = [
  {
    label: 'Script',
    get items() {
      const running = isRunning()
      return [
        { label: 'New', run: () => okToReplace() && setText('', 'untitled.js') },
        {
          label: 'Open…',
          run: async () => {
            const [p] = await pickFiles(false)
            if (p) openScriptFile(p.file, p.handle)
          },
        },
        { label: 'Save', run: () => saveScript() },
        { label: 'Save As…', run: () => saveScript(true) },
        'sep' as const,
        {
          label: 'Templates',
          items: templates.map((t) => ({
            label: t.name,
            // Bundled templates are trusted, so choosing one runs it (scripts from files/drops never auto-run).
            run: () => {
              if (!okToReplace()) return
              setText(t.code, `${t.name}.js`)
              runScript() // no-op if a script is already running
            },
          })),
        },
        {
          label: 'Insert',
          items: snippets.map(([label, code]) => ({ label, run: () => insert(`${code}\n`) })),
        },
        'sep' as const,
        { label: 'Run', shortcut: 'Shift+Enter', local: true, disabled: running, run: runScript },
        { label: 'Stop', disabled: !running, run: stop },
      ]
    },
  },
]

export function ScriptPanel() {
  const host = useRef<HTMLDivElement>(null)
  const output = useNv(() => [...script.output])
  const running = useNv(isRunning)
  const name = useNv(() => `${script.dirty ? '• ' : ''}${script.name}`)
  const [locating, setLocating] = useState<{ name: string; done: (f?: File) => void } | null>(null)
  const outRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!host.current || script.view) return
    script.view = new EditorView({
      parent: host.current,
      extensions: [
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-s', // in the editor, ⌘S saves the script, not the scene
              preventDefault: true,
              run: () => {
                saveScript()
                return true
              },
            },
            {
              key: 'Shift-Enter',
              run: () => {
                runScript()
                return true
              },
            },
            {
              key: 'Escape',
              run: () => {
                if (!isRunning()) return false
                stop()
                return true
              },
            },
          ]),
        ),
        // Files dropped on the editor are opened by the app, not inserted as text.
        Prec.highest(EditorView.domEventHandlers({ drop: (e) => !!e.dataTransfer?.files.length })),
        basicSetup,
        javascript(),
        // Any change except a whole-script replacement counts: typing, Insert, undo/redo.
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return
          script.revision++
          if (!script.dirty) {
            script.dirty = true
            bump()
          }
        }),
        EditorView.contentAttributes.of({ 'aria-label': 'Script editor' }),
      ],
    })
    return () => {
      script.view?.destroy()
      script.view = undefined
    }
  }, [])

  useEffect(() => {
    locator.locate = (n) => new Promise((done) => setLocating({ name: n, done }))
    // Stop closes the open dialog and settles its request.
    locator.close = () =>
      setLocating((l) => {
        l?.done(undefined)
        return null
      })
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on each new line
  useEffect(() => {
    outRef.current?.scrollTo(0, outRef.current.scrollHeight)
  }, [output.length])

  const finish = (f?: File) => {
    const request = locating
    request?.done(f)
    setLocating((l) => (l === request ? null : l)) // a slow picker must not close a newer dialog
  }

  return (
    <div className="script">
      <div className="script-bar">
        <span className="script-name">{name}</span>
        <button
          type="button"
          onClick={running ? stop : runScript}
          title={running ? 'Stop (Esc)' : 'Run (Shift+Enter)'}
        >
          {running ? 'Stop' : 'Run'}
        </button>
      </div>
      <div className="editor" ref={host} />
      <pre className="output" ref={outRef} aria-live="polite">
        {output.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
          <div key={i} className={l.kind}>
            {l.text}
          </div>
        ))}
      </pre>
      <Dialog.Root open={!!locating} onOpenChange={(o) => !o && finish()}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog small">
            <Dialog.Title>Locate {locating?.name}</Dialog.Title>
            <Dialog.Description>
              The script needs “{locating?.name}”. Choose the file on your computer, or use File ▸ Open
              Folder… so scripts can find files by name.
            </Dialog.Description>
            <div className="buttons">
              <button type="button" className="button" onClick={() => finish()}>
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={async () => finish((await pickFiles(false))[0]?.file)}
              >
                Locate…
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
