import { useEffect, useRef, useState } from 'react'
import type { PostEntry } from '../types'

export type PushState = 'pending' | 'synced' | 'error'

export interface MobileSession {
  pushState: PushState
  /** Na "Verbinding mislukt": opnieuw proberen. */
  retry: () => void
  /** Zendingen met een gekozen ontvanger (naam + adres): alleen die komen op de telefoon. */
  selectedEntries: PostEntry[]
}

/** URL die de telefoon opent (via de QR-code) om foto's bij deze sessie te zetten. */
export function mobileUrl(sessionId: string): string {
  const viteAppUrl = import.meta.env.VITE_APP_URL
  const appUrl = (viteAppUrl?.startsWith('http') ? viteAppUrl : window.location.origin).replace(/\/$/, '')
  return `${appUrl}/?mobile=${sessionId}`
}

/**
 * Houdt de telefoonsessie bij: stuurt de zendingen met een gekozen ontvanger naar
 * de backend, zodat de telefoon (na het scannen van de QR-code) weet waar foto's bij
 * horen. Staat los van de weergave: de QR-code mag verdwijnen en terugkomen (nieuw
 * formulier na verzenden) zonder dat de sessie opnieuw begint.
 */
export function useMobileSession(
  sessionId: string,
  entries: PostEntry[],
  onSessionReady?: () => void,
  enabled = true,
): MobileSession {
  const [pushState, setPushState] = useState<PushState>('pending')
  const [retryCount, setRetryCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const hasSyncedRef = useRef(false)
  const onSessionReadyRef = useRef(onSessionReady)
  onSessionReadyRef.current = onSessionReady

  const selectedEntries = entries.filter(e => e.name && e.adres)

  // Push entries naar backend; na eerste sync gaan vervolgpushes stil
  useEffect(() => {
    if (!enabled) return
    // Ook een lege lijst doorsturen zodra de sessie loopt: anders blijft een net
    // verzonden zending op de telefoon staan en kan er nog een foto bij.
    if (selectedEntries.length === 0 && !hasSyncedRef.current) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!hasSyncedRef.current) {
      setPushState('pending')
    }

    fetch('/.netlify/functions/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        entries: selectedEntries.map(e => ({ id: e.id, name: e.name, colli: e.colli, colliOmschrijvingen: (e.colliOmschrijvingen ?? []).slice(0, e.colli), desktopPhotoCount: e.photos.length })),
      }),
      signal: controller.signal,
    })
      .then(r => {
        if (controller.signal.aborted) return
        if (!hasSyncedRef.current) {
          if (r.ok) {
            hasSyncedRef.current = true
            setPushState('synced')
            onSessionReadyRef.current?.()
          } else {
            setPushState('error')
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && !hasSyncedRef.current) {
          setPushState('error')
        }
      })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, JSON.stringify(selectedEntries.map(e => e.id + e.name + e.colli + e.photos.length + (e.colliOmschrijvingen ?? []).join('\x00'))), retryCount])

  return { pushState, retry: () => setRetryCount(c => c + 1), selectedEntries }
}
