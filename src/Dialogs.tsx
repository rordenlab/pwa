import { SLICE_TYPE } from '@niivue/niivue/webgl2'
import { Dialog } from 'radix-ui'
import { lazy, type ReactNode, Suspense, useState } from 'react'
import pkg from '../package.json'
import { installSteps } from './install'
import { hasFSA } from './io/fs'
import { bump, nv, useNv } from './nv'
import { Check, Choice, Range } from './panels/fields'
import { prefs, RESOLUTIONS, type Resolution, savePrefs, setQuality } from './prefs'
import { sceneSection } from './script/aiBrief'
import { app, notify } from './state'

type Which = 'prefs' | 'about' | 'gestures' | 'reference' | 'install' | null
const Reference = lazy(() => import('./script/Reference'))
let open: Which = null
const show = (w: Which) => {
  open = w
  bump()
}

app.editMenu = [{ label: 'Preferences…', shortcut: 'Mod+,', run: () => show('prefs') }]
/**
 * Help ▸ Copy Prompt for AI: the AI brief (public/llms.txt) plus the current scene, ready to paste into
 * an assistant. The clipboard gets a promise so Safari still counts the menu click as user activation.
 */
export async function copyAIPrompt() {
  const text = (async () => {
    const brief = await (await fetch(`${import.meta.env.BASE_URL}llms.txt`)).text()
    const scene = sceneSection({
      volumes: nv.volumes.map((v) => ({
        name: v.name,
        colormap: v.colormap,
        calMin: v.calMin,
        calMax: v.calMax,
        colormapNegative: v.colormapNegative,
      })),
      meshes: nv.meshes.map((m) => ({ name: m.name, kind: m.kind, layers: m.layers.map((l) => l.name) })),
      sliceType: nv.sliceType,
    })
    return new Blob([`${brief}\n${scene}\n## Request\n(Describe the scene you want MRIvue to show.)\n`], {
      type: 'text/plain',
    })
  })()
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])
    notify(
      'AI prompt copied: paste it into your assistant, describe the scene, then paste the reply into Script.',
    )
  } catch (e) {
    notify(`Copy failed: ${(e as Error).message}`)
  }
}

app.showInstallHelp = () => show('install')

app.helpMenu = [
  { label: 'Mouse Gestures', run: () => show('gestures') },
  { label: 'Scripting Reference', run: () => show('reference') },
  { label: 'Copy Prompt for AI', run: copyAIPrompt },
  {
    label: 'AI Brief (llms.txt)',
    run: () => window.open(`${import.meta.env.BASE_URL}llms.txt`, '_blank', 'noopener'),
  },
  { label: 'About MRIvue', run: () => show('about') },
]

const VIEWS: Record<string, number> = {
  Axial: SLICE_TYPE.AXIAL,
  Coronal: SLICE_TYPE.CORONAL,
  Sagittal: SLICE_TYPE.SAGITTAL,
  Multiplanar: SLICE_TYPE.MULTIPLANAR,
  Render: SLICE_TYPE.RENDER,
}

function Prefs() {
  const [p, setP] = useState({ ...prefs })
  const set = (u: Partial<typeof prefs>) => {
    setP({ ...p, ...u })
    savePrefs(u)
  }
  return (
    <div className="props">
      <Choice
        label="Theme"
        value={{ system: 'Follow system', light: 'Light', dark: 'Dark' }[p.theme]}
        options={['Follow system', 'Light', 'Dark']}
        onChange={(t) => set({ theme: t === 'Light' ? 'light' : t === 'Dark' ? 'dark' : 'system' })}
      />
      <Choice
        label="Startup view"
        value={Object.keys(VIEWS).find((k) => VIEWS[k] === p.startupView) ?? 'Multiplanar'}
        options={Object.keys(VIEWS)}
        onChange={(v) => set({ startupView: VIEWS[v] })}
      />
      <Check
        label="Open MNI152 template at startup"
        value={p.startTemplate}
        onChange={(startTemplate) => set({ startTemplate })}
      />
      <Check
        label="Radiological convention"
        value={p.radiological}
        onChange={(radiological) => set({ radiological })}
      />
      <Check
        label="Antialiasing (MSAA)"
        value={p.antialias}
        onChange={(antialias) => {
          setP({ ...p, antialias })
          setQuality({ antialias })
        }}
      />
      <Choice
        label="Resolution"
        value={RESOLUTIONS[p.resolution]}
        options={Object.values(RESOLUTIONS)}
        onChange={(label) => {
          const resolution =
            (Object.keys(RESOLUTIONS) as Resolution[]).find((r) => RESOLUTIONS[r] === label) ?? 'auto'
          setP({ ...p, resolution })
          setQuality({ resolution })
        }}
      />
      <Range
        label={`Bitmap zoom ×${p.bitmapZoom}`}
        value={p.bitmapZoom}
        min={1}
        max={4}
        step={1}
        onChange={(bitmapZoom) => set({ bitmapZoom })}
      />
    </div>
  )
}

const GESTURES: [string, string][] = [
  ['2D: click or drag', 'Move the crosshair'],
  ['2D: right-drag', 'Adjust contrast (darkest/brightest)'],
  ['2D: scroll', 'Step through slices'],
  ['3D: drag', 'Rotate'],
  ['3D: scroll', 'Zoom, or move the active clip plane'],
  ['Drop files', 'Add volumes, meshes, or a .nvd scene'],
]

function Body({ which }: { which: Exclude<Which, null> }): ReactNode {
  if (which === 'prefs') return <Prefs />
  if (which === 'install')
    return (
      <div className="props">
        <p>
          Installed, MRIvue opens in its own window, works offline, and can open files from your computer's
          file browser.
        </p>
        <p>{installSteps()}</p>
      </div>
    )
  if (which === 'reference')
    return (
      <Suspense fallback={<p>Loading…</p>}>
        <Reference
          insert={(text) => {
            app.insertScript?.(text)
            show(null)
          }}
        />
      </Suspense>
    )
  if (which === 'gestures')
    return (
      <table className="gestures">
        <tbody>
          {GESTURES.map(([g, d]) => (
            <tr key={g}>
              <th>{g}</th>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  return (
    <div className="props">
      <p>
        MRIvue is a desktop-style viewer for brain volumes and meshes, in the spirit of MRIcroGL and Surfice,
        built on NiiVue.
      </p>
      <p className="note">
        NiiVue {pkg.dependencies['@niivue/niivue']} · {nv.view ? 'WebGL2' : 'no renderer'} ·{' '}
        {hasFSA ? 'desktop file access' : 'open and download only'}
      </p>
    </div>
  )
}

const TITLE = {
  prefs: 'Preferences',
  about: 'About MRIvue',
  install: 'Install as App',
  gestures: 'Mouse Gestures',
  reference: 'Scripting Reference',
}

export function Dialogs() {
  const which = useNv(() => open)
  return (
    <Dialog.Root open={!!which} onOpenChange={(o) => !o && show(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={`dialog${which === 'reference' ? '' : ' small'}`}
          aria-describedby={undefined}
        >
          {which && (
            <>
              <Dialog.Title>{TITLE[which]}</Dialog.Title>
              <Body which={which} />
              <Dialog.Close className="button">Close</Dialog.Close>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
