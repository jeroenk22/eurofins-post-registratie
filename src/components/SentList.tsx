import { useEffect, useRef } from 'react'
import { getSelectedFormat, printLabels } from '../services/printService'
import { dagoverzichtMailto, type SentItem } from '../services/sentToday'

interface SentListProps {
  items: SentItem[]
  /** De zojuist verzonden zending: valt op, zodat printen de logische volgende stap is. */
  highlightId: string | null
  senderEmail: string
  senderCcEmail: string
}

const tijd = (iso: string) =>
  new Date(iso).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })

/** "Vandaag verzonden" op de desktop: per zending het ordernummer en opnieuw printen. */
export default function SentList({ items, highlightId, senderEmail, senderCcEmail }: SentListProps) {
  const listRef = useRef<HTMLUListElement>(null)

  // Nieuwste staat bovenaan: na verzenden terug naar boven, zodat de printknop in beeld is.
  useEffect(() => {
    if (highlightId) listRef.current?.scrollTo?.({ top: 0 })
  }, [highlightId])

  return (
    // Vult de rest van de kolom; alleen de lijst scrolt, de kop blijft staan.
    <aside aria-label="Vandaag verzonden" className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-700">
          Vandaag verzonden <span className="font-normal text-gray-400">({items.length})</span>
        </h2>
        {items.length > 0 && (
          <a
            href={dagoverzichtMailto(items, senderEmail, senderCcEmail)}
            className="text-xs font-semibold text-ef-blue hover:underline"
          >
            ✉ Dagoverzicht mailen
          </a>
        )}
      </div>

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
              className={`card p-3 border-l-4 border-l-mi-green ${nieuw ? 'ring-2 ring-inset ring-mi-green/60' : ''}`}
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
