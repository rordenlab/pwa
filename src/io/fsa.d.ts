// File System Access API surface used here (Chromium only; not in the TS DOM lib).
interface FileSystemHandle {
  queryPermission(d?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(d?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}
interface FilePickerOptions {
  multiple?: boolean
  suggestedName?: string
  id?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}
interface Window {
  showOpenFilePicker(o?: FilePickerOptions): Promise<FileSystemFileHandle[]>
  showSaveFilePicker(o?: FilePickerOptions): Promise<FileSystemFileHandle>
  showDirectoryPicker(o?: { mode?: 'read' | 'readwrite'; id?: string }): Promise<FileSystemDirectoryHandle>
  launchQueue?: { setConsumer(f: (p: { files: FileSystemFileHandle[] }) => void): void }
}
interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
}
interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>
}
