import { useEffect, useRef, useState } from 'react'
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
 * Een knop in de blauwe balk met een samenvatting; het paneel zweeft eronder, zodat
 * de zending er niet door naar beneden schuift. Geel zolang er nog geen naam is.
 */
export default function SettingsPanel({
  store, open, onOpenChange, showErrors, formatId, onFormatChange, mailPerZending, onMailPerZendingChange,
}: SettingsPanelProps) {
  const [showCc, setShowCc] = useState(() => store.senderCcEmail !== '')
  const ref = useRef<HTMLDivElement>(null)
  const format = LABEL_FORMATS.find(f => f.id === formatId)
  const naamBekend = store.senderName.trim() !== ''

  // Sluiten bij klikken buiten het paneel of Escape.
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  const samenvatting = [
    store.senderName.trim(),
    store.senderEmail.trim(),
    format?.name.split(' – ')[0],
    mailPerZending ? 'mail per zending' : 'geen mail per zending',
  ].filter(Boolean).join(' · ')

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label="Instellingen"
        className={`max-w-[42rem] flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
          naamBekend
            ? 'bg-white/10 text-white hover:bg-white/20'
            : 'bg-mi-yellow text-gray-900 font-semibold hover:bg-mi-yellow/90'
        }`}
      >
        <span aria-hidden="true">⚙</span>
        <span className="truncate">{naamBekend ? samenvatting : 'Vul eerst je gegevens in'}</span>
        <span aria-hidden="true" className="flex-shrink-0 opacity-70">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <section
          aria-label="Instellingen voor deze werkplek"
          className="absolute right-0 top-full mt-2 z-50 w-[40rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="h-1 bg-mi-yellow" />
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-800">⚙ Instellingen voor deze werkplek</h2>
                <p className="text-xs text-gray-400">Eén keer invullen; ze worden op deze computer onthouden.</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Instellingen sluiten"
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <SenderFields
              store={store}
              showErrors={showErrors}
              showCc={showCc}
              onShowCcChange={setShowCc}
              columns
            />

            <div className="grid grid-cols-2 gap-x-4 mt-3 pt-3 border-t border-gray-100 items-start">
              <div>
                <p className="label-base">Labelformaat</p>
                <LabelFormatSelect value={formatId} onChange={onFormatChange} />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer pt-5">
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
        </section>
      )}
    </div>
  )
}
