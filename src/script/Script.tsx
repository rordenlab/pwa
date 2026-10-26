import { javascript } from '@codemirror/lang-javascript'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { basicSetup, EditorView } from 'codemirror'
import { Dialog, Tooltip } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { copyAIPrompt } from '../Dialogs'
import { download, pickFiles, pickSave, write } from '../io/fs'
import { bump, useNv } from '../nv'
import { app, notify } from '../state'
import { decodeScript, encodeScript, LINK } from './link'
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
  /** Where an unreviewed script came from ('link', 'paste'): shown with a review banner until replaced. */
  origin: '',
  view: undefined as EditorView | undefined,
}
addEventListener('beforeunload', (e) => {
  if (script.dirty) e.preventDefault()
})

const text = () => script.view?.state.doc.toString() ?? ''
// Replacing the whole script (New/Open/Templates) is not an edit: dirty is reset right after.
function setText(t: string, name: string, handle?: FileSystemFileHandle, origin = '') {
  script.view?.dispatch({ changes: { from: 0, to: script.view.state.doc.length, insert: t } })
  Object.assign(script, { name, handle, dirty: false, origin, id: script.id + 1 })
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

// Links fill the editor but never run: the user reviews, then presses Run.
async function openLink(code = location.hash.match(LINK)?.[1]) {
  if (!code) return
  if (location.hash) history.replaceState(null, '', location.pathname + location.search) // a reload does not re-import
  if (!okToReplace()) return
  try {
    setText(await decodeScript(code), 'shared.js', undefined, 'link')
  } catch {
    notify('This script link is damaged or incomplete.')
  }
}
addEventListener('hashchange', () => openLink())

// Pasting a script (or a script link) anywhere outside a text field opens it for review, so a reply
// from an AI assistant needs no trip to the menus.
addEventListener('paste', (e) => {
  const t = e.target as HTMLElement
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
  const text = e.clipboardData?.getData('text/plain') ?? ''
  const link = text.match(LINK)?.[1]
  if (!link && !/\bnv\.\w/.test(text)) return
  e.preventDefault()
  if (link) openLink(link)
  else if (okToReplace()) setText(text.replace(/^```\w*\n|\n?```\s*$/g, ''), 'pasted.js', undefined, 'paste') // drop a Markdown fence
})

// Chat apps often cut long links.
const LONG_LINK = 8000

function copyLink() {
  const url = (async () => `${location.origin}${location.pathname}#script=${await encodeScript(text())}`)()
  // A promise keeps Safari's user activation across the async encode.
  navigator.clipboard
    .write([new ClipboardItem({ 'text/plain': url.then((u) => new Blob([u], { type: 'text/plain' })) })])
    .then(async () => {
      const n = (await url).length
      notify(
        n > LONG_LINK
          ? `Link copied (${Math.round(n / 1024)} KB): chat apps may truncate links this long; share the .js file instead.`
          : 'Link copied: opening it shows this script for review; it runs only when Run is pressed.',
      )
    })
    .catch((e) => notify(`Copy failed: ${(e as Error).message}`))
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
        { label: 'Copy Link', run: copyLink },
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
  const name = useNv(() => `${script.dirty ? '• ' : ''}${script.name}`)
  const origin = useNv(() => script.origin)
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
    openLink()
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
      </div>
      {origin && (
        <p className="banner" role="note">
          This script came from a {origin}: review before running.
        </p>
      )}
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

/**
 * Always-visible rail at the right edge: scripting stays discoverable while its pane is closed.
 */
export function ScriptRail() {
  const open = useNv(() => app.scriptOpen)
  const running = useNv(isRunning)
  const shared = useNv(() => script.origin === 'link')
  const items = [
    {
      icon: '{ }',
      title: 'Script editor',
      tip: `${open ? 'Hide' : 'Show'} the editor (⌘J). Tip: paste a script or script link anywhere to open it.`,
      state: open ? 'shown' : 'hidden',
      run: () => app.togglePane?.('script'),
    },
    {
      icon: running ? '■' : '▶',
      title: running ? 'Stop script' : shared ? 'Run shared script' : 'Run script',
      tip: running ? 'Stop the running script (Esc)' : 'Run the script in the editor (Shift+Enter)',
      run: running ? stop : runScript,
    },
    {
      icon: '✦',
      title: 'Copy Prompt for AI',
      tip: 'Copies a prompt describing MRIvue and this scene. Paste it into an AI assistant, then paste its reply here.',
      run: copyAIPrompt,
    },
  ]
  return (
    <Tooltip.Provider delayDuration={300} disableHoverableContent>
      <nav className="strip rail" aria-label="Scripting">
        {items.map((it) => (
          <Tooltip.Root key={it.title}>
            <Tooltip.Trigger asChild>
              <button type="button" aria-label={it.title} data-state={it.state} onClick={it.run}>
                {it.icon}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip" side="left" sideOffset={6}>
                <strong>{it.title}</strong>
                <span>{it.tip}</span>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </nav>
    </Tooltip.Provider>
  )
}
