import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../types'

interface SessionData {
  photos: Record<string, Photo[]>
  updatedAt: number
}

export function useMobilePhotoSync(
  sessionId: string,
  onPhotosReceived: (entryId: string, photos: Photo[]) => void,
  enabled: boolean,
) {
  const [syncedEntryIds, setSyncedEntryIds] = useState<Set<string>>(new Set())
  const idsKey = `sync_ids_${sessionId}`
  const lastUpdatedRef = useRef(0)
  // Bewaar per entry welke foto-IDs al gesynchroniseerd zijn, ook na refresh
  const knownPhotoIdsRef = useRef<Record<string, Set<string>>>((() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(idsKey) ?? '{}') as Record<string, string[]>
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, new Set(v)]))
    } catch { return {} }
  })())
  const callbackRef = useRef(onPhotosReceived)
  callbackRef.current = onPhotosReceived

  useEffect(() => {
    if (!enabled) return

    const poll = async () => {
      try {
        const r = await fetch(`/.netlify/functions/session?id=${encodeURIComponent(sessionId)}`)
        if (!r.ok) return
        const data: SessionData = await r.json()
        if (data.updatedAt <= lastUpdatedRef.current) return
        lastUpdatedRef.current = data.updatedAt

        const added: string[] = []
        for (const [entryId, photos] of Object.entries(data.photos)) {
          const known = knownPhotoIdsRef.current[entryId] ?? new Set<string>()
          const newPhotos = photos.filter(p => !known.has(p.id))
          if (newPhotos.length > 0) {
            if (!knownPhotoIdsRef.current[entryId]) knownPhotoIdsRef.current[entryId] = new Set()
            photos.forEach(p => knownPhotoIdsRef.current[entryId].add(p.id))
            try {
              const toSave = Object.fromEntries(
                Object.entries(knownPhotoIdsRef.current).map(([k, v]) => [k, [...v]])
              )
              sessionStorage.setItem(idsKey, JSON.stringify(toSave))
            } catch { /* ignore */ }
            callbackRef.current(entryId, newPhotos)
            added.push(entryId)
          }
        }
        if (added.length > 0) {
          setSyncedEntryIds(prev => {
            const next = new Set(prev)
            added.forEach(id => next.add(id))
            return next
          })
        }
      } catch {
        // silent fail
      }
    }

    const interval = setInterval(poll, 3000)
    poll()
    return () => clearInterval(interval)
  }, [sessionId, enabled])

  return syncedEntryIds
}
