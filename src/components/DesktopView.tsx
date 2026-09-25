import { useState, type ReactNode } from 'react'
import type { PostEntry } from '../types'
import type { Store } from '../useStore'
import type { RecipientOption } from '../services/googleSheetsService'
import { submitToWebhook, resubmitToMake, SubmitError } from '../webhookService'
import { validateForm } from '../validation'
import { getSelectedFormat, setSelectedFormat, toPrintEntry } from '../services/printService'
import { addSentToday, loadSentToday, type SentItem } from '../services/sentToday'
import { getMailPerZending, setMailPerZending } from '../services/desktopSettings'
import { loadPending, savePending, clearPending, PENDING_HINT, type StoredPending } from '../services/pendingSubmission'
import Header from './Header'
import PostCard from './PostCard'
import SettingsPanel from './SettingsPanel'
import SentList from './SentList'

interface DesktopViewProps {
  store: Store
  recipients: RecipientOption[]
  /** QR-code voor foto's via de telefoon; staat boven "Vandaag verzonden". */
  qrPanel?: ReactNode
}

/**
 * Desktop: één zending tegelijk invullen en direct verzenden. Een verzonden
 * zending verlaat het formulier en staat rechts onder "Vandaag verzonden", met
 * het ordernummer en de printknop (labels mét QR-code). Wat in het formulier
 * staat is dus altijd nog niet verzonden: dubbel verzenden kan niet.
 */
export default function DesktopView({ store, recipients, qrPanel }: DesktopViewProps) {
  // Nieuwe werkplek (nog geen naam bekend): instellingen open.
  const [settingsOpen, setSettingsOpen] = useState(() => !store.senderName.trim())
  const [formatId, setFormatId] = useState(() => getSelectedFormat().id)
  const [mailPerZending, setMailState] = useState(getMailPerZending)
  const [sent, setSent] = useState<SentItem[]>(() => loadSentToday())
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [pending, setPending] = useState<StoredPending | null>(loadPending)
  const [error, setError] = useState<{ entryId: string; message: string } | null>(null)
  const [showEntryErrors, setShowEntryErrors] = useState(false)
  const [showSenderErrors, setShowSenderErrors] = useState(false)

  const handleFormatChange = (id: string) => {
    setSelectedFormat(id)
    setFormatId(id)
  }

  const handleMailChange = (aan: boolean) => {
    setMailPerZending(aan)
    setMailState(aan)
  }

  // De zending die Verzenden verstuurt: de bovenste.
  const current = store.entries[0]

  const handleSend = async (entry: PostEntry) => {
    const { senderName, senderPhone, senderEmail, senderCcEmail } = store
    const senderErr = validateForm([], senderName, senderEmail, senderCcEmail, senderPhone)
    if (senderErr) {
      setSettingsOpen(true)
      setShowSenderErrors(true)
      setError({ entryId: entry.id, message: senderErr })
      return
    }
    setShowSenderErrors(false)

    // Orders bestaan al voor deze zending: alleen Make nog, zelfde payload.
    const retry = pending && (pending.entryId === undefined || pending.entryId === entry.id) ? pending : null
    if (!retry) {
      const entryErr = validateForm([entry], senderName, senderEmail, senderCcEmail, senderPhone)
      if (entryErr) {
        setShowEntryErrors(true)
        setError({ entryId: entry.id, message: entryErr })
        return
      }
    }

    setSendingId(entry.id)
    setError(null)
    try {
      const { submittedAt, orderIds } = retry
        ? await resubmitToMake(retry)
        : await submitToWebhook([entry], senderName, senderPhone, senderEmail, senderCcEmail, {
            mailVersturen: mailPerZending,
          })
      setPending(null)
      clearPending()

      const orderId = orderIds[0] ?? null
      const item: SentItem = {
        id: `${submittedAt}_${entry.id}`,
        sentAt: submittedAt,
        orderId,
        label: toPrintEntry(entry, submittedAt, orderId),
      }
      setSent(addSentToday(item))
      setHighlightId(item.id)
      setShowEntryErrors(false)
      setSettingsOpen(false)
      // Uit het formulier: wat daar staat is nooit verzonden.
      if (store.entries.length > 1) store.removeEntry(entry.id)
      else store.reset()
    } catch (e) {
      const nowPending = e instanceof SubmitError && e.pending ? { ...e.pending, entryId: entry.id } : null
      if (nowPending) {
        setPending(nowPending)
        savePending(nowPending)
      }
      setError({
        entryId: entry.id,
        message: `Verzenden mislukt: ${e instanceof Error ? e.message : 'Onbekende fout'}${nowPending ? PENDING_HINT : ''}`,
      })
    } finally {
      setSendingId(null)
    }
  }

  return (
    // Schermvullend: de kop (met rechts de instellingen) bovenaan, daaronder twee
    // kolommen die elk zelf scrollen. De invultegel groeit tot 46rem; alles daarnaast
    // is voor de verzonden zendingen, in zoveel kolommen als er passen.
    <div className="h-screen flex flex-col bg-[#e3e9f2] overflow-hidden">
      <div className="shrink-0">
        <Header
          actions={
            <SettingsPanel
              store={store}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              showErrors={showSenderErrors}
              formatId={formatId}
              onFormatChange={handleFormatChange}
              mailPerZending={mailPerZending}
              onMailPerZendingChange={handleMailChange}
            />
          }
        />
      </div>

      {/* Blauwgrijze achtergrond met iets zwaardere schaduw en veldranden: de tegels
          springen eruit. Alleen hier; de telefoon houdt zijn eigen, lichte opmaak. */}
      <main className="flex-1 min-h-0 [&_.card]:shadow-md [&_.input-base]:border-gray-300 grid gap-4 lg:gap-6 px-4 lg:px-6 pt-4 pb-4 grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_minmax(19rem,34%)] xl:grid-cols-[minmax(0,46rem)_minmax(0,1fr)]">
        {/* Verzenden staat direct onder de zending, en blijft onderin in beeld als
            de zending hoger is dan het scherm (sticky). */}
        <section aria-label="Nieuwe zending" className="min-h-0 overflow-y-auto pr-1">
          {store.entries.map((entry, i) => (
            <PostCard
              key={entry.id}
              entry={entry}
              index={i}
              onUpdate={store.updateEntry}
              onRemove={store.removeEntry}
              showRemove={store.entries.length > 1}
              recipients={recipients}
              showErrors={showEntryErrors && error?.entryId === entry.id}
            />
          ))}
          {/* Normaal is er één zending; staan er (uit een oud concept) meer, dan gaan ze om de beurt. */}
          {current && (
            <div className="sticky bottom-0 bg-[#e3e9f2] pt-1 pb-1">
              {error?.entryId === current.id && (
                <div
                  role="alert"
                  className="mb-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600"
                >
                  {error.message}
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleSend(current)}
                disabled={sendingId !== null}
                className={`w-full py-3.5 rounded-xl text-white text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all ${
                  sendingId !== null
                    ? 'bg-ef-blue/60 cursor-not-allowed'
                    : 'bg-ef-blue hover:bg-ef-blue/90 active:scale-[0.98]'
                }`}
              >
                {sendingId === current.id ? '⏳ Bezig met verzenden…' : '📤 Verzenden'}
              </button>
            </div>
          )}
        </section>

        <div className="min-h-0 flex flex-col">
          <div className="shrink-0">{qrPanel}</div>
          <SentList
            items={sent}
            highlightId={highlightId}
            senderName={store.senderName}
            senderEmail={store.senderEmail}
            senderCcEmail={store.senderCcEmail}
          />
        </div>
      </main>
      {/* Versie in de hoek: bij een vraag kun je hem voorlezen, maar hij kost geen hoogte. */}
      <p className="fixed bottom-1.5 right-3 text-xs text-slate-500 pointer-events-none">v{__APP_VERSION__}</p>
    </div>
  )
}
