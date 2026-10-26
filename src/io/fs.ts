// The only module touching FSA, <input type=file>, downloads and stored handles (plan §6).
import { idbGet, idbSet } from './idb'

export const hasFSA = typeof window !== 'undefined' && 'showOpenFilePicker' in window
export type Picked = { file: File; handle?: FileSystemFileHandle }

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

/** Open files; [] when cancelled. */
export async function pickFiles(multiple = true): Promise<Picked[]> {
  if (hasFSA) {
    try {
      const handles = await window.showOpenFilePicker({ multiple, id: 'open' })
      return Promise.all(handles.map(async (handle) => ({ handle, file: await handle.getFile() })))
    } catch (e) {
      if (isAbort(e)) return []
      throw e
    }
  }
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', multiple })
    input.onchange = () => resolve(Array.from(input.files ?? [], (file) => ({ file })))
    input.oncancel = () => resolve([])
    input.click()
  })
}

/** Ask for a save target while the click's user activation is fresh. undefined = cancelled; null = no FSA. */
export async function pickSave(suggestedName: string): Promise<FileSystemFileHandle | null | undefined> {
  if (!hasFSA) return null
  try {
    return await window.showSaveFilePicker({ suggestedName, id: 'save' })
  } catch (e) {
    if (isAbort(e)) return undefined
    throw e
  }
}

export async function write(handle: FileSystemFileHandle, data: Blob) {
  const w = await handle.createWritable()
  try {
    await w.write(data)
    await w.close()
  } catch (e) {
    await w.abort().catch(() => {})
    throw e
  }
}

export function download(name: string, data: Blob) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(data), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export async function permitted(handle: FileSystemHandle, mode: 'read' | 'readwrite' = 'read') {
  if ((await handle.queryPermission({ mode })) === 'granted') return true
  return (await handle.requestPermission({ mode })) === 'granted' // needs a user click
}

export async function gzip(data: Blob): Promise<Blob> {
  return new Response(data.stream().pipeThrough(new CompressionStream('gzip'))).blob()
}

const EXTS = ['', '.nii.gz', '.nii', '.mz3', '.gii']

/** A file in the granted workspace by relative path, trying common extensions; asks for permission if needed. */
export async function inWorkspace(dir: FileSystemDirectoryHandle, path: string): Promise<File | undefined> {
  if (!(await permitted(dir).catch(() => false))) return undefined
  const parts = path.split('/').filter(Boolean)
  const name = parts.pop() as string
  try {
    for (const p of parts) dir = await dir.getDirectoryHandle(p)
  } catch {
    return undefined
  }
  for (const e of EXTS)
    try {
      return await (await dir.getFileHandle(name + e)).getFile()
    } catch {}
  return undefined
}

/** A recent entry by base name: its URL, or its file if read permission is (or can be) granted. */
export async function inRecent(list: Recent[], name: string): Promise<File | string | undefined> {
  for (const e of EXTS)
    for (const r of list) {
      if (r.name !== name + e) continue
      if (r.url) return r.url
      if (r.handle && (await permitted(r.handle).catch(() => false))) return r.handle.getFile()
    }
  return undefined
}

// Recent files and workspace folder persist as handles.
export type Recent = { name: string; handle?: FileSystemFileHandle; url?: string }
export const loadRecent = async () => (await idbGet<Recent[]>('recent')) ?? []
export async function addRecent(items: Recent[]) {
  const list = await loadRecent()
  for (const it of items) {
    for (let i = list.length - 1; i >= 0; i--) {
      const old = list[i]
      if (old.url ? old.url === it.url : it.handle && (await old.handle?.isSameEntry(it.handle)))
        list.splice(i, 1)
    }
    list.unshift(it)
  }
  list.length = Math.min(list.length, 10)
  await idbSet('recent', list)
  return list
}
export const loadWorkspace = () => idbGet<FileSystemDirectoryHandle>('workspace')
export async function pickWorkspace() {
  try {
    const dir = await window.showDirectoryPicker({ mode: 'read', id: 'workspace' })
    await idbSet('workspace', dir)
    return dir
  } catch (e) {
    if (isAbort(e)) return undefined
    throw e
  }
}

/** Files opened via the OS ("Open With") when installed with manifest file_handlers. */
export function onLaunch(open: (items: Picked[]) => void) {
  window.launchQueue?.setConsumer(async ({ files }) => {
    if (!files.length) return
    try {
      open(await Promise.all(files.map(async (handle) => ({ handle, file: await handle.getFile() }))))
    } catch (e) {
      console.warn('Could not open launched files', e) // io stays UI-free
    }
  })
}

/** Fetch a URL as a named File; HTTP errors throw (a 404 page must not be parsed as data). */
export async function fetchFile(url: string, name = url.slice(url.lastIndexOf('/') + 1)): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`)
  return new File([await res.blob()], name)
}
