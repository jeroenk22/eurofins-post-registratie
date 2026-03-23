import { useEffect, useRef, useState } from 'react'
import type { PostEntry } from '../types'

interface Props {
  sessionId: string
  entries: PostEntry[]
  syncedEntryIds: Set<string>
}

type PushState = 'pending' | 'synced' | 'error'

export default function QrCodeFloat({ sessionId, entries, syncedEntryIds }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [pushState, setPushState] = useState<PushState>('pending')
  const [retryCount, setRetryCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const viteAppUrl = import.meta.env.VITE_APP_URL
  const appUrl = (viteAppUrl?.startsWith('http') ? viteAppUrl : window.location.origin).replace(/\/$/, '')
  const mobileUrl = `${appUrl}/?mobile=${sessionId}`

  const selectedEntries = entries.filter(e => e.name && e.adres)

  // Push entries to backend; toon QR pas na bevestiging
  useEffect(() => {
    if (selectedEntries.length === 0) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPushState('pending')
    setQrDataUrl('')

    fetch('/.netlify/functions/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        entries: selectedEntries.map(e => ({ id: e.id, name: e.name })),
      }),
      signal: controller.signal,
    })
      .then(r => {
        if (!controller.signal.aborted) {
          setPushState(r.ok ? 'synced' : 'error')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setPushState('error')
      })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, JSON.stringify(selectedEntries.map(e => e.id + e.name)), retryCount])

  // Genereer QR zodra push geslaagd is en paneel open staat
  useEffect(() => {
    if (pushState !== 'synced' || collapsed) return
    setQrDataUrl('')
    import('qrcode').then(mod => {
      const QRCode = (mod.default ?? mod) as { toDataURL: (text: string, opts: object) => Promise<string> }
      return QRCode.toDataURL(mobileUrl, {
        width: 164,
        margin: 1,
        color: { dark: '#003c71', light: '#ffffff' },
      })
    }).then(url => setQrDataUrl(url)).catch(() => {})
  }, [mobileUrl, pushState, collapsed])

  if (selectedEntries.length === 0) return null

  return (
    <div className="hidden md:block fixed top-6 right-6 z-50">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-56">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-ef-blue text-white hover:bg-ef-blue/90 transition-colors"
        >
          <span>📱</span>
          <span className="text-sm font-semibold flex-1 text-left">Foto's via mobiel</span>
          <span className="text-xs opacity-70">{collapsed ? '▲' : '▼'}</span>
        </button>

        {!collapsed && (
          <div className="p-3">
            <div className="flex justify-center mb-2">
              {pushState === 'error' ? (
                <div className="w-[164px] h-[164px] rounded-lg bg-red-50 flex flex-col items-center justify-center gap-2">
                  <p className="text-xs text-red-400 text-center px-2">Verbinding mislukt</p>
                  <button
                    type="button"
                    onClick={() => setRetryCount(c => c + 1)}
                    className="text-xs text-ef-blue underline"
                  >
                    Opnieuw
                  </button>
                </div>
              ) : !qrDataUrl ? (
                <div className="w-[164px] h-[164px] rounded-lg bg-gray-50 animate-pulse" />
              ) : (
                <img src={qrDataUrl} alt="QR code" width={164} height={164} className="rounded-lg" />
              )}
            </div>
            <p className="text-[11px] text-gray-400 text-center mb-3 leading-tight">
              Scan met je telefoon om<br />foto's toe te voegen
            </p>

            <div className="space-y-1.5 border-t border-gray-100 pt-2">
              {selectedEntries.map(e => {
                const synced = syncedEntryIds.has(e.id)
                const hasLocalPhotos = e.photos.length > 0
                return (
                  <div key={e.id} className="flex items-center gap-1.5 text-xs">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 ${
                      synced
                        ? 'bg-green-100 text-green-600'
                        : hasLocalPhotos
                          ? 'bg-blue-100 text-blue-500'
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {synced ? '✓' : hasLocalPhotos ? e.photos.length : '○'}
                    </span>
                    <span className="text-gray-600 truncate">{e.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
