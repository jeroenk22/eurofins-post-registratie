import { useEffect, useRef, useState } from 'react'
import { getSelectedFormat, printLabels } from '../services/printService'
import type { SentItem } from '../services/sentToday'
import { mailDagoverzicht } from '../services/dagoverzicht'

interface SentListProps {
  items: SentItem[]
  /** De zojuist verzonden zending: valt op, zodat printen de logische volgende stap is. */
  highlightId: string | null
  senderName: string
  senderEmail: string
  senderCcEmail: string
}

type MailState = { status: 'idle' } | { status: 'sending' } | { status: 'sent'; to: string } | { status: 'error'; message: string }

const tijd = (iso: string) =>
  new Date(iso).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })

/** "Vandaag verzonden" op de desktop: per zending het ordernummer en opnieuw printen. */
export default function SentList({ items, highlightId, senderName, senderEmail, senderCcEmail }: SentListProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const [mail, setMail] = useState<MailState>({ status: 'idle' })
  const totaalColli = items.reduce((som, i) => som + i.label.colli, 0)

  const handleMail = async () => {
    setMail({ status: 'sending' })
    try {
      await mailDagoverzicht(items, senderEmail, senderCcEmail, senderName)
      setMail({ status: 'sent', to: senderEmail.trim() })
    } catch (e) {
      setMail({ status: 'error', message: e instanceof Error ? e.message : 'Versturen mislukt' })
    }
  }

  // Alle labels van vandaag in één printopdracht, in de volgorde van verzenden.
  const printAlles = () => printLabels([...items].reverse().map(i => i.label), getSelectedFormat())

  // Nieuwste staat bovenaan: na verzenden terug naar boven, zodat de printknop in beeld is.
  useEffect(() => {
    if (highlightId) listRef.current?.scrollTo?.({ top: 0 })
  }, [highlightId])

  return (
    // Vult de rest van de kolom; alleen de lijst scrolt, de kop blijft staan.
    <aside aria-label="Vandaag verzonden" className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-700">
          Vandaag verzonden <span className="font-normal text-gray-400">({items.length})</span>
        </h2>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printAlles}
              className="rounded-lg bg-ef-blue/10 text-ef-blue hover:bg-ef-blue/20 text-xs font-semibold px-2.5 py-1.5 transition-colors"
            >
              🖨 Alle labels printen ({totaalColli})
            </button>
            <button
              type="button"
              onClick={() => void handleMail()}
              disabled={mail.status === 'sending' || !senderEmail.trim()}
              title={senderEmail.trim() ? `Naar ${senderEmail.trim()}` : 'Vul eerst je e-mailadres in bij de instellingen'}
              className="rounded-lg bg-ef-blue text-white hover:bg-ef-blue/90 disabled:bg-ef-blue/40 disabled:cursor-not-allowed text-xs font-semibold px-2.5 py-1.5 transition-colors"
            >
              {mail.status === 'sending' ? '⏳ Versturen…' : '✉ Dagoverzicht mailen'}
            </button>
          </div>
        )}
      </div>
      {mail.status === 'sent' && (
        <p role="status" className="shrink-0 -mt-1 mb-3 text-xs text-mi-green">✓ Dagoverzicht verstuurd naar {mail.to}.</p>
      )}
      {mail.status === 'error' && (
        <p role="alert" className="shrink-0 -mt-1 mb-3 text-xs text-red-600">{mail.message}</p>
      )}
      {items.length > 0 && !senderEmail.trim() && (
        <p className="shrink-0 -mt-1 mb-3 text-xs text-gray-400">Vul bij de instellingen je e-mailadres in om het dagoverzicht te mailen.</p>
      )}

      {items.length === 0 && (
        <p className="text-xs text-gray-400 leading-relaxed">
          Nog niets verzonden vandaag. Verzonden zendingen komen hier te staan, met het ordernummer en een knop om de labels te printen.
        </p>
      )}

      {/* Zoveel kolommen als er passen: één op een laptop, vier of meer op een breed scherm. */}
      <ul ref={listRef} className="flex-1 min-h-0 overflow-y-auto pr-1 pb-1 grid gap-2 content-start grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]">
        {items.map(item => {
          const l = item.label
          const nieuw = item.id === highlightId
          return (
            <li
              key={item.id}
              // Streep: oranje bij SPOED, anders groen. ! nodig: .card staat in de CSS ná border-l-* en zou hem overschrijven.
              className={`card p-3 !border-l-4 ${l.spoed ? '!border-l-ef-orange' : '!border-l-mi-green'} ${nieuw ? 'ring-2 ring-inset ring-mi-green/60' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-gray-800">
                  <span className="text-mi-green">✓</span> {tijd(item.sentAt)}
                </p>
                <p className={`text-xs font-bold ${item.orderId ? 'text-gray-800' : 'text-amber-700'}`}>
                  {item.orderId ? `Order ${item.orderId}` : 'Geen ordernummer'}
                </p>
              </div>
              <p className="text-sm text-gray-700 truncate mt-0.5" title={l.name}>{l.name}</p>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="text-xs text-gray-500">
                  {[l.route, `${l.colli} colli`].filter(Boolean).join(' · ')}
                  {l.spoed && <span className="ml-1.5 font-bold text-ef-orange">SPOED</span>}
                </p>
                <button
                  type="button"
                  onClick={() => printLabels([l], getSelectedFormat())}
                  className={`flex-shrink-0 rounded-lg text-xs font-semibold px-2.5 py-1.5 transition-colors ${
                    nieuw
                      ? 'bg-ef-blue text-white hover:bg-ef-blue/90'
                      : 'bg-ef-blue/10 text-ef-blue hover:bg-ef-blue/20'
                  }`}
                >
                  🖨 Print {l.colli} {l.colli === 1 ? 'label' : 'labels'}
                </button>
              </div>
              {!item.orderId && (
                <p className="text-[11px] text-amber-700 mt-1">
                  De order in Mendrix is niet aangemaakt; het label heeft geen QR-code.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
