import { useEffect, useRef, type ReactNode } from 'react'
import { getSelectedFormat, printLabels } from '../services/printService'
import type { SentItem } from '../services/sentToday'

interface SentDetailModalProps {
  item: SentItem
  onClose: () => void
}

const RECIPIENT_TYPE_NAAM: Record<string, string> = {
  Monsternemers: 'Monsternemer',
  AP06: 'AP06',
  Mestklanten: 'Mestklant',
}

const tijdstip = (iso: string) =>
  new Date(iso).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

function Rij({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 break-words">{children}</dd>
    </div>
  )
}

function Blok({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="pt-3 mt-3 border-t border-gray-100 first:border-t-0 first:mt-0 first:pt-0">
      <h3 className="label-base mb-1">{titel}</h3>
      <dl className="divide-y divide-gray-50">{children}</dl>
    </section>
  )
}

/** Alles van één verzonden zending op een rij (desktop). Sluiten met ✕, Escape of een klik ernaast. */
export default function SentDetailModal({ item, onClose }: SentDetailModalProps) {
  const sluitRef = useRef<HTMLButtonElement>(null)
  const l = item.label
  const d = item.details
  const omschrijvingen = Array.from({ length: l.colli }, (_, i) => l.colliOmschrijvingen[i]?.trim() ?? '')
  const adres = [l.adres, [l.postcode, l.plaats].filter(Boolean).join(' '), l.land].filter(s => s?.trim())

  useEffect(() => {
    sluitRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Zending ${l.name}`}
        onClick={e => e.stopPropagation()}
        className="w-[34rem] max-w-full max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        <div className={`h-1.5 shrink-0 ${l.spoed ? 'bg-ef-orange' : 'bg-mi-green'}`} />

        <header className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">
              <span className="text-mi-green font-bold">✓ Verzonden</span> · {tijdstip(item.sentAt)}
            </p>
            <h2 className="text-lg font-bold text-gray-800 mt-0.5 break-words">{l.name}</h2>
            <p className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`text-sm font-bold ${item.orderId ? 'text-ef-blue' : 'text-amber-700'}`}>
                {item.orderId ? `Order ${item.orderId}` : 'Geen ordernummer'}
              </span>
              {l.spoed && (
                <span className="rounded bg-ef-orange text-white text-[11px] font-bold px-1.5 py-0.5">SPOED</span>
              )}
            </p>
          </div>
          <button
            ref={sluitRef}
            type="button"
            onClick={onClose}
            aria-label="Venster sluiten"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {!item.orderId && (
            <p className="mb-3 px-3 py-2 rounded-lg bg-amber-50 text-xs text-amber-800">
              De order in Mendrix is niet aangemaakt; het label heeft geen QR-code.
            </p>
          )}

          <Blok titel="Ontvanger">
            <Rij label="Naam">{l.name}</Rij>
            {d?.recipientType && <Rij label="Soort">{RECIPIENT_TYPE_NAAM[d.recipientType] ?? d.recipientType}</Rij>}
            {adres.length > 0 && (
              <Rij label="Adres">
                {adres.map(regel => <span key={regel} className="block">{regel}</span>)}
              </Rij>
            )}
          </Blok>

          <Blok titel="Zending">
            {/* Oudere zendingen hebben alleen de route van het label. */}
            <Rij label="Schap">{d?.schap ?? (l.route || '—')}</Rij>
            <Rij label="Aantal colli">{l.colli}</Rij>
            {omschrijvingen.some(Boolean) && (
              <Rij label="Omschrijving">
                <ol className="space-y-0.5">
                  {omschrijvingen.map((o, i) => (
                    <li key={i}>
                      {l.colli > 1 && <span className="text-gray-400 tabular-nums mr-1.5">{i + 1}.</span>}
                      {o || <span className="text-gray-400">—</span>}
                    </li>
                  ))}
                </ol>
              </Rij>
            )}
            <Rij label="Prioriteit">{l.spoed ? <span className="font-bold text-ef-orange">Spoed</span> : 'Normaal'}</Rij>
            {d && <Rij label="Foto's">{d.photoCount === 0 ? 'Geen' : d.photoCount}</Rij>}
          </Blok>

          {d && (
            <Blok titel="Aangemeld door">
              <Rij label="Naam">{d.senderName || '—'}</Rij>
              {d.senderPhone && <Rij label="Telefoon">{d.senderPhone}</Rij>}
              {d.senderEmail && <Rij label="E-mail">{d.senderEmail}</Rij>}
              {d.senderCcEmail && <Rij label="CC">{d.senderCcEmail}</Rij>}
              <Rij label="Bevestigingsmail">{d.mailVerstuurd ? 'Ja' : 'Nee (komt in het dagoverzicht)'}</Rij>
            </Blok>
          )}
        </div>

        <footer className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg text-gray-600 hover:bg-gray-200 text-xs font-semibold px-3 py-2 transition-colors"
          >
            Sluiten
          </button>
          <button
            type="button"
            onClick={() => printLabels([l], getSelectedFormat())}
            className="rounded-lg bg-ef-blue text-white hover:bg-ef-blue/90 text-xs font-semibold px-3 py-2 transition-colors"
          >
            🖨 Print {l.colli} {l.colli === 1 ? 'label' : 'labels'}
          </button>
        </footer>
      </div>
    </div>
  )
}
