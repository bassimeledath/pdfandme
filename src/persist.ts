import { Ann, PageMeta } from './types'

/**
 * Crash/refresh recovery. The document bytes and edits are saved to
 * IndexedDB on this device only — consistent with the no-upload promise.
 */

export interface SavedSession {
  fileName: string
  bytes: ArrayBuffer
  pages: PageMeta[]
  anns: Ann[]
  formValues: Record<string, string | boolean>
  savedAt: number
}

const DB_NAME = 'pdfandme'
const STORE = 'session'
const KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function saveSession(s: SavedSession): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.put(s, KEY))
  } catch {
    /* private mode / quota — recovery just won't be available */
  }
}

export async function loadSession(): Promise<SavedSession | null> {
  try {
    const s = await withStore<SavedSession | undefined>('readonly', (store) => store.get(KEY))
    return s && s.bytes ? s : null
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(KEY))
  } catch {
    /* nothing to clear */
  }
}
