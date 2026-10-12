import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../types'

type SessionData =
  | { ongewijzigd?: false; photos: Record<string, Photo[]>; updatedAt: number }
  /** Niets veranderd sinds `since`: de server stuurt de foto's dan niet mee. */
  | { ongewijzigd: true; updatedAt: number }

/** Alleen een paar bytes per keer zolang er niets verandert (zie `since`), dus snel kan. */
const POLL_MS = 1500

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

    let bezig = false
    const poll = async () => {
      // Tabblad niet in beeld: niet vragen. Bij terugkomen meteen (zie onVisible).
      // En nooit twee tegelijk, ook niet als een antwoord langer dan POLL_MS duurt.
      if (bezig || document.visibilityState === 'hidden') return
      bezig = true
      try {
        const since = lastUpdatedRef.current > 0 ? `&since=${lastUpdatedRef.current}` : ''
        const r = await fetch(`/.netlify/functions/session?id=${encodeURIComponent(sessionId)}${since}`)
        if (!r.ok) return
        const data: SessionData = await r.json()
        if (data.ongewijzigd || data.updatedAt <= lastUpdatedRef.current) return
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
      } finally {
        bezig = false
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') void poll() }
    const interval = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    poll()
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sessionId, enabled])

  return syncedEntryIds
}
