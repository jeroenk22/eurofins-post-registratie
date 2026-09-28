import { useEffect, useState } from 'react'
import type { PostEntry } from '../types'
import { mobileUrl, useMobileSession } from '../hooks/useMobileSession'

interface Props {
  sessionId: string
  entries: PostEntry[]
  syncedEntryIds: Set<string>
  onSessionReady?: () => void
}

/** Zwevend QR-paneel rechtsboven. De desktop gebruikt MobilePhotoQr in het fotovak. */
export default function QrCodeFloat({ sessionId, entries, syncedEntryIds, onSessionReady }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const { pushState, retry, selectedEntries } = useMobileSession(sessionId, entries, onSessionReady)
  const url = mobileUrl(sessionId)

  // Genereer QR eenmalig zodra eerste push geslaagd is en paneel open staat
  useEffect(() => {
    if (pushState !== 'synced' || collapsed || qrDataUrl) return
    import('qrcode').then(mod => {
      const QRCode = (mod.default ?? mod) as { toDataURL: (text: string, opts: object) => Promise<string> }
      return QRCode.toDataURL(url, {
        width: 164,
        margin: 1,
        color: { dark: '#003c71', light: '#ffffff' },
      })
    }).then(setQrDataUrl).catch(() => {})
  }, [url, pushState, collapsed, qrDataUrl])

  if (selectedEntries.length === 0) return null

  return (
    <div className="hidden md:block fixed top-6 right-6 z-50">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xl w-56">
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
                    onClick={retry}
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
            <div>
              <p className="text-[11px] text-gray-400 mb-3 leading-tight text-center">
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
          </div>
        )}
      </div>
    </div>
  )
}
