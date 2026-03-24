import type { Photo } from './types'

const DB_NAME = 'mobile-photos-db'
const STORE_NAME = 'photos'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function loadPhotos(sessionId: string): Promise<Record<string, Photo[]>> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(sessionId)
      req.onsuccess = () => resolve((req.result as Record<string, Photo[]>) ?? {})
      req.onerror = () => reject(req.error)
    })
  } catch {
    return {}
  }
}

export async function savePhotos(sessionId: string, photos: Record<string, Photo[]>): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(photos, sessionId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Foto's blijven in memory, uploaden werkt nog steeds
  }
}

export async function clearPhotos(sessionId: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(sessionId)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Silently fail
  }
}
