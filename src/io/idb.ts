// Minimal IndexedDB key/value store: FSA handles are structured-cloneable, localStorage can't hold them.
const db = new Promise<IDBDatabase>((resolve, reject) => {
  const r = indexedDB.open('niivue-pwa', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('kv')
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
})

function req<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db.then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const r = f(d.transaction('kv', mode).objectStore('kv'))
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      }),
  )
}

export const idbGet = <T>(key: string) =>
  req<T | undefined>('readonly', (s) => s.get(key)).catch(() => undefined)
export const idbSet = (key: string, value: unknown) =>
  req('readwrite', (s) => s.put(value, key)).catch(() => {})
