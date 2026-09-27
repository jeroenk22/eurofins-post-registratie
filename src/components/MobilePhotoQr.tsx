import { useEffect, useRef, useState } from 'react'
import { Check, QrCode } from 'lucide-react'
import { mobileUrl, type PushState } from '../hooks/useMobileSession'

interface MobilePhotoQrProps {
  sessionId: string
  pushState: PushState
  onRetry: () => void
  /** Ontvanger gekozen: pas dan staat de zending op de telefoon. */
  ready: boolean
  /** Er zijn foto's van de telefoon binnengekomen voor deze zending. */
  received: boolean
}

/**
 * Desktop: "Via telefoon" (met QR-icoon) naast het kopje Foto's. Een klik toont de QR-code in
 * een zwevend venstertje boven het fotovak, zodat er niets verspringt.
 * Sluiten met ✕, Escape of een klik ernaast.
 */
export default function MobilePhotoQr({ sessionId, pushState, onRetry, ready, received }: MobilePhotoQrProps) {
  const [open, setOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const url = mobileUrl(sessionId)

  useEffect(() => {
    if (!open || pushState !== 'synced' || qrDataUrl) return
    import('qrcode').then(mod => {
      const QRCode = (mod.default ?? mod) as { toDataURL: (text: string, opts: object) => Promise<string> }
      return QRCode.toDataURL(url, { width: 152, margin: 1, color: { dark: '#003c71', light: '#ffffff' } })
    }).then(setQrDataUrl).catch(() => {})
  }, [open, pushState, qrDataUrl, url])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Zonder ontvanger staat er niets op de telefoon om een foto bij te zetten.
  const aan = open && ready

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={!ready}
        aria-expanded={aan}
        title={ready ? "Foto's maken met je telefoon" : 'Kies eerst een ontvanger'}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 -my-1 text-xs font-semibold transition-colors disabled:bg-gray-50 disabled:border-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed ${
          aan
            ? 'bg-ef-blue border-ef-blue text-white'
            : 'bg-ef-blue/10 border-ef-blue/20 text-ef-blue hover:bg-ef-blue/20'
        }`}
      >
        <QrCode size={15} strokeWidth={2.25} aria-hidden="true" />
        Via telefoon
        {received && <Check size={14} strokeWidth={3} className={aan ? 'text-white' : 'text-mi-green'} aria-label="foto's ontvangen" />}
      </button>

      {aan && (
        <div
          role="dialog"
          aria-label="Foto's via telefoon"
          className="absolute right-0 bottom-full mb-2 z-40 w-[19rem] bg-white rounded-xl shadow-2xl border border-gray-200 p-3"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
              <QrCode size={16} className="text-ef-blue" aria-hidden="true" /> Foto's via telefoon
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="QR-code sluiten"
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {pushState === 'error' ? (
                <div className="w-[152px] h-[152px] rounded-lg bg-red-50 flex flex-col items-center justify-center gap-2">
                  <p className="text-xs text-red-400 text-center px-2">Verbinding mislukt</p>
                  <button type="button" onClick={onRetry} className="text-xs text-ef-blue underline">Opnieuw</button>
                </div>
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code" width={152} height={152} className="rounded-lg" />
              ) : (
                <div className="w-[152px] h-[152px] rounded-lg bg-gray-50 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-gray-500 leading-snug">
              Scan met je telefoon en maak de foto's daar. Ze komen vanzelf bij deze zending.
              {received && <span className="block mt-2 font-semibold text-mi-green">✓ Foto's ontvangen</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
