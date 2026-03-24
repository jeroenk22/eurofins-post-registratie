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
  const storageKey = `sync_updated_${sessionId}`
  const lastUpdatedRef = useRef((() => {
    try { return parseInt(sessionStorage.getItem(storageKey) ?? '0', 10) } catch { return 0 }
  })())
  const knownCountsRef = useRef<Record<string, number>>({})
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
        try { sessionStorage.setItem(storageKey, String(data.updatedAt)) } catch { /* ignore */ }

        const added: string[] = []
        for (const [entryId, photos] of Object.entries(data.photos)) {
          const prev = knownCountsRef.current[entryId] ?? 0
          if (photos.length > 0 && photos.length !== prev) {
            knownCountsRef.current[entryId] = photos.length
            callbackRef.current(entryId, photos)
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
