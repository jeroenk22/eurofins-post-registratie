import { useCallback, useEffect, useRef, useState } from 'react'
import { getSelectedFormat, printLabels } from '../services/printService'
import type { SentItem } from '../services/sentToday'
import { mailDagoverzicht } from '../services/dagoverzicht'
import SentDetailModal from './SentDetailModal'

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
  const [detail, setDetail] = useState<SentItem | null>(null)
  const closeDetail = useCallback(() => setDetail(null), [])
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={printAlles}
              className="whitespace-nowrap rounded-lg bg-ef-blue/10 text-ef-blue hover:bg-ef-blue/20 text-xs font-semibold px-2.5 py-1.5 transition-colors"
            >
              🖨 Alle labels printen ({totaalColli})
            </button>
            <button
              type="button"
              onClick={() => void handleMail()}
              disabled={mail.status === 'sending' || !senderEmail.trim()}
              title={senderEmail.trim() ? `Naar ${senderEmail.trim()}` : 'Vul eerst je e-mailadres in bij de instellingen'}
              className="whitespace-nowrap rounded-lg bg-ef-blue text-white hover:bg-ef-blue/90 disabled:bg-ef-blue/40 disabled:cursor-not-allowed text-xs font-semibold px-2.5 py-1.5 transition-colors"
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

      {/* Zoveel kolommen als er passen (zie DesktopView): één op een klein scherm, drie op
          een laptop, vier of meer op een breed scherm; tegels rekken mee tot de rij vol is.
          Min. 15rem, zodat er op 1366px drie passen; vanaf 1536px 17rem, zodat een laptop
          van ~1600px drie ruime tegels houdt i.p.v. vier krappe. Vol = nieuwe rij en verticaal scrollen. */}
      <ul ref={listRef} className="flex-1 min-h-0 overflow-y-auto pr-1 pb-1 grid gap-2 content-start grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]">
        {items.map(item => {
          const l = item.label
          const nieuw = item.id === highlightId
          return (
            <li
              key={item.id}
              // Klik op de tegel = details; de printknop houdt zijn eigen klik.
              onClick={() => setDetail(item)}
              // Streep: oranje bij SPOED, anders groen. ! nodig: .card staat in de CSS ná border-l-* en zou hem overschrijven.
              className={`card p-3 cursor-pointer hover:!shadow-lg transition-shadow !border-l-4 ${l.spoed ? '!border-l-ef-orange' : '!border-l-mi-green'} ${nieuw ? 'ring-2 ring-inset ring-mi-green/60' : ''}`}
            >
              {/* SPOED staat bovenin: onderaan maakte het de regel op een smalle tegel te lang. */}
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-gray-800 whitespace-nowrap">
                  <span><span className="text-mi-green">✓</span> {tijd(item.sentAt)}</span>
                  {l.spoed && <span className="rounded bg-ef-orange text-white text-[10px] leading-none px-1 py-0.5">SPOED</span>}
                </p>
                {/* De uitleg staat in de tooltip en het detailvenster: zo blijven alle tegels even hoog. */}
                <p
                  title={item.orderId ? undefined : 'De order in Mendrix is niet aangemaakt; het label heeft geen QR-code.'}
                  className={`text-xs font-bold whitespace-nowrap ${item.orderId ? 'text-gray-800' : 'text-amber-700'}`}
                >
                  {item.orderId ? `Order ${item.orderId}` : 'Geen ordernummer'}
                </p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setDetail(item) }}
                aria-label={`Details van ${l.name}`}
                title="Details bekijken"
                // Geen eigen hover: de hele tegel is klikbaar. Wel een knop, voor het toetsenbord.
                className="block w-full text-left text-sm text-gray-700 truncate mt-0.5 focus:outline-none focus-visible:underline"
              >
                {l.name}
              </button>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="min-w-0 truncate text-xs text-gray-500">
                  {[l.route, `${l.colli} colli`].filter(Boolean).join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); printLabels([l], getSelectedFormat()) }}
                  className={`flex-shrink-0 whitespace-nowrap rounded-lg text-xs font-semibold px-2.5 py-1.5 transition-colors ${
                    nieuw
                      ? 'bg-ef-blue text-white hover:bg-ef-blue/90'
                      : 'bg-ef-blue/10 text-ef-blue hover:bg-ef-blue/20'
                  }`}
                >
                  🖨 Print {l.colli} {l.colli === 1 ? 'label' : 'labels'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {detail && <SentDetailModal item={detail} onClose={closeDetail} />}
    </aside>
  )
}
