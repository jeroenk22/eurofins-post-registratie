import { useState } from 'react'
import type { Store } from '../useStore'
import { LABEL_FORMATS } from '../services/printService'
import SenderFields from './SenderFields'
import LabelFormatSelect from './LabelFormatSelect'

interface SettingsPanelProps {
  store: Store
  open: boolean
  onOpenChange: (open: boolean) => void
  showErrors: boolean
  formatId: string
  onFormatChange: (id: string) => void
  mailPerZending: boolean
  onMailPerZendingChange: (aan: boolean) => void
}

/**
 * Instellingen per werkplek (desktop): afzender, labelformaat en de mail per zending.
 * Ingeklapt één regel; uitgeklapt de velden.
 */
export default function SettingsPanel({
  store, open, onOpenChange, showErrors, formatId, onFormatChange, mailPerZending, onMailPerZendingChange,
}: SettingsPanelProps) {
  const [showCc, setShowCc] = useState(() => store.senderCcEmail !== '')
  const format = LABEL_FORMATS.find(f => f.id === formatId)

  const samenvatting = [
    store.senderName.trim() || 'Nog geen naam',
    store.senderPhone.trim(),
    store.senderEmail.trim(),
    store.senderCcEmail.trim() && `cc ${store.senderCcEmail.trim()}`,
    format?.name.split(' – ')[0],
    mailPerZending ? 'mail per zending' : 'geen mail per zending',
  ].filter(Boolean).join(' · ')

  return (
    <section className="card mb-5" aria-label="Instellingen">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-base" aria-hidden="true">⚙</span>
        <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">
          <span className="font-semibold">Afzender:</span> {samenvatting}
        </span>
        <span className="flex-shrink-0 text-xs font-semibold text-ef-blue">
          {open ? 'Inklappen ▴' : 'Wijzigen ▾'}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pt-4 pb-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <SenderFields
            store={store}
            showErrors={showErrors}
            showCc={showCc}
            onShowCcChange={setShowCc}
          />
          <div className="space-y-4">
            <div>
              <p className="label-base">Labelformaat</p>
              <LabelFormatSelect value={formatId} onChange={onFormatChange} />
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={mailPerZending}
                onChange={e => onMailPerZendingChange(e.currentTarget.checked)}
                className="mt-0.5 h-4 w-4 accent-ef-blue"
              />
              <span className="text-sm text-gray-700">
                Bevestigingsmail bij elke verzonden zending
                <span className="block text-xs text-gray-400 mt-0.5">
                  Uit? Stuur aan het eind van de dag één overzicht met “Dagoverzicht mailen”.
                </span>
              </span>
            </label>
          </div>
        </div>
      )}
    </section>
  )
}
