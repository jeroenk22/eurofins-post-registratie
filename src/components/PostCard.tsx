import { useState, useRef, useEffect } from 'react'
import type { PostEntry, Photo } from '../types'
import PhotoUpload from './PhotoUpload'
import RecipientAutocomplete from './RecipientAutocomplete'
import type { RecipientOption } from '../services/googleSheetsService'

import MestklantSelect from './MestklantSelect'
import { getSelectedFormat, setSelectedFormat, printLabels } from '../services/printService'
import { serverNow } from '../services/serverTime'
import LabelFormatSelect from './LabelFormatSelect'

const SHELVES = [1, 2, 3, 4, 5, 6, 7, 8] as const

interface PostCardProps {
  entry: PostEntry
  index: number
  onUpdate: (id: string, patch: Partial<PostEntry>) => void
  onRemove: (id: string) => void
  showRemove: boolean
  recipients: RecipientOption[]
  showErrors?: boolean
}

export default function PostCard({ entry, index, onUpdate, onRemove, showRemove, recipients, showErrors = false }: PostCardProps) {
  const set = <K extends keyof PostEntry>(key: K, val: PostEntry[K]) =>
    onUpdate(entry.id, { [key]: val } as Partial<PostEntry>)

  const [andersIndices, setAndersIndices] = useState<Set<number>>(new Set())

  const updatePhotos = (fn: (prev: Photo[]) => Photo[]) =>
    onUpdate(entry.id, { photos: fn(entry.photos) })

  const allDescriptionsFilled =
    entry.colli > 0 &&
    Array.from({ length: entry.colli }, (_, i) => entry.colliOmschrijvingen[i] ?? '').every(d => d.trim() !== '')
  const showPrintLink = !!entry.name.trim() && allDescriptionsFilled

  const [printPopupOpen, setPrintPopupOpen] = useState(false)
  const [formatId, setFormatId] = useState(() => getSelectedFormat().id)
  const printBtnRef = useRef<HTMLButtonElement>(null)
  const printPopupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!printPopupOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (printBtnRef.current?.contains(t) || printPopupRef.current?.contains(t)) return
      setPrintPopupOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPrintPopupOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [printPopupOpen])

  const handlePrint = () => {
    const format = getSelectedFormat()
    const route = entry.shelf === 'overig' ? '' : entry.shelf ? `Route ${entry.shelf}` : ''
    // Deze labels worden vóór het versturen geprint; de order bestaat dan nog niet.
    // We tonen het huidige tijdstip, dat in de praktijk vlak voor het versturen ligt.
    printLabels([{ name: entry.name.trim(), adres: entry.adres, postcode: entry.postcode, plaats: entry.plaats, land: entry.land, route, colli: entry.colli, colliOmschrijvingen: entry.colliOmschrijvingen, spoed: entry.spoed, orderedAt: serverNow().toISOString() }], format)
    setPrintPopupOpen(false)
  }

  return (
    <div className={`relative card p-4 mb-3 transition-all ${entry.spoed ? 'border-l-4 border-l-ef-orange' : ''}`}>

      {/* Card header */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${entry.spoed ? 'bg-ef-orange' : 'bg-ef-blue'}`}>
          {index + 1}
        </span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {entry.name && <span className="text-xs text-gray-500 truncate">{entry.name}</span>}
          {entry.shelf && (
            <span className="text-xs text-ef-blue font-semibold flex-shrink-0">
              {entry.shelf === 'overig' ? 'Overig' : `Schap ${entry.shelf}`}
            </span>
          )}
          {entry.spoed && (
            <span className="flex-shrink-0 h-6 flex items-center text-[10px] font-bold text-ef-orange border border-ef-orange/40 bg-ef-orange-light rounded px-1.5">
              SPOED
            </span>
          )}
        </div>
        {showPrintLink && (
          <button
            ref={printBtnRef}
            type="button"
            onClick={() => setPrintPopupOpen(o => !o)}
            aria-label="Print label voor deze zending"
            className="h-6 rounded bg-ef-blue/10 border border-ef-blue/20 text-ef-blue hover:bg-ef-blue/20 text-[10px] font-semibold hidden md:flex items-center gap-1 px-1.5 transition-colors flex-shrink-0"
          >
            🖨 Print
          </button>
        )}
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            aria-label="Verwijder zending"
            className="w-6 h-6 rounded-md bg-red-50 border border-red-100 text-red-400 hover:bg-red-100 hover:text-red-600 text-sm flex items-center justify-center transition-colors flex-shrink-0"
          >
            ×
          </button>
        )}
      </div>

      {/* Print popup — absoluut over de kaart, volledige breedte */}
      {printPopupOpen && (
        <div ref={printPopupRef} className="absolute right-0 top-14 z-50 w-[340px] bg-white border border-gray-200 rounded-xl shadow-lg p-3 hidden md:flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600">Labelformaat</p>
            <button
              type="button"
              onClick={() => setPrintPopupOpen(false)}
              aria-label="Sluit"
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>
          <LabelFormatSelect
            value={formatId}
            onChange={id => { setSelectedFormat(id); setFormatId(id) }}
          />
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-2 rounded-lg bg-ef-blue text-white text-xs font-semibold hover:bg-ef-blue/90 transition-colors"
          >
            Print {entry.colli} {entry.colli === 1 ? 'label' : 'labels'}
          </button>
        </div>
      )}

      {/* Naam */}
      <div className="mb-3">
        <RecipientAutocomplete
          id={`name-${entry.id}`}
          value={entry.name}
          onChange={v => {
            onUpdate(entry.id, { name: v, adres: '', postcode: '', plaats: '', land: '' })
            if (!v) { set('shelf', null); set('spoed', false); set('colli', 1); set('recipientType', undefined); setAndersIndices(new Set()) }
          }}
          onSelect={option => {
            const n = Number(option.route)
            const shelf = Number.isInteger(n) && n >= 1 && n <= 8 ? n : null
            onUpdate(entry.id, {
              adres: option.adres,
              postcode: option.postcode,
              plaats: option.plaats,
              land: option.land,
              shelf,
              recipientType: option.type,
              colliOmschrijvingen: [],
              ...(shelf === null && { spoed: false }),
            })
            setAndersIndices(new Set())
          }}
          recipients={recipients}
          invalid={showErrors && !entry.name.trim()}
        />
      </div>

      {/* Schap selector */}
      <div className="mb-3">
        <p className="label-base">Schap nummer *</p>
        <div className={`grid grid-cols-9 gap-1.5${showErrors && !entry.shelf ? ' rounded-lg ring-2 ring-red-400' : ''}`}>
          {SHELVES.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => set('shelf', n)}
              className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                entry.shelf === n
                  ? 'bg-ef-blue text-white border-ef-blue'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-ef-blue hover:text-ef-blue'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set('shelf', 'overig')}
            title="Overig"
            className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
              entry.shelf === 'overig'
                ? 'bg-ef-blue text-white border-ef-blue'
                : 'bg-white text-gray-500 border-gray-200 hover:border-ef-blue hover:text-ef-blue'
            }`}
          >
            ★
          </button>
        </div>
        <input
          type="text"
          className={`input-base mt-1.5${entry.shelf !== 'overig' ? ' hidden' : ''}${showErrors && entry.shelf === 'overig' && !entry.shelfDescription.trim() ? ' !border-red-400' : ''}`}
          placeholder="Beschrijf waar de zending klaar ligt..."
          value={entry.shelfDescription}
          onChange={e => set('shelfDescription', e.currentTarget.value)}
          aria-label="Locatiebeschrijving overige plek"
        />
      </div>

      {/* Colli + Spoed */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="label-base">Aantal colli</p>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => entry.colli > 1 && set('colli', entry.colli - 1)}
              className="w-10 h-10 text-gray-500 hover:bg-gray-50 text-lg flex items-center justify-center transition-colors flex-shrink-0"
            >
              −
            </button>
            <span className="flex-1 text-center text-sm font-semibold text-gray-800 tabular-nums">
              {entry.colli}
            </span>
            <button
              type="button"
              onClick={() => set('colli', entry.colli + 1)}
              className="w-10 h-10 text-gray-500 hover:bg-gray-50 text-lg flex items-center justify-center transition-colors flex-shrink-0"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <p className="label-base">Prioriteit</p>
          <button
            type="button"
            role="checkbox"
            aria-checked={entry.spoed}
            onClick={() => set('spoed', !entry.spoed)}
            className={`w-full h-10 rounded-lg border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              entry.spoed
                ? 'bg-ef-orange-light border-ef-orange/40 text-ef-orange'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            ⚡ Spoed
          </button>
        </div>
      </div>

      {/* Colli omschrijvingen */}
      <div className="mb-3 space-y-1.5">
        {Array.from({ length: entry.colli }, (_, i) => {
          const omschrijving = (entry.colliOmschrijvingen ?? [])[i] ?? ''
          const updateOmschrijving = (val: string) => {
            const updated = [...(entry.colliOmschrijvingen ?? [])]
            updated[i] = val
            set('colliOmschrijvingen', updated)
          }
          const placeholder = entry.colli > 1 ? `Omschrijving collo ${i + 1}` : 'Omschrijving collo'
          const colloError = showErrors && !omschrijving.trim()
          return (
            <div key={i} className="relative">
              {entry.recipientType === 'Mestklanten' ? (
                <div className="space-y-1">
                  <MestklantSelect
                    value={omschrijving}
                    isAnders={andersIndices.has(i)}
                    onChange={val => { setAndersIndices(prev => { const s = new Set(prev); s.delete(i); return s }); updateOmschrijving(val) }}
                    onClear={() => { setAndersIndices(prev => { const s = new Set(prev); s.delete(i); return s }); updateOmschrijving('') }}
                    onSelectAnders={() => { setAndersIndices(prev => new Set(prev).add(i)); updateOmschrijving('') }}
                    placeholder={placeholder}
                    invalid={colloError}
                  />
                  {andersIndices.has(i) && (
                    <div className="relative">
                      <input
                        type="text"
                        className={`input-base !pr-7${colloError ? ' !border-red-400' : ''}`}
                        placeholder="Vrije omschrijving..."
                        value={omschrijving}
                        onChange={e => updateOmschrijving(e.currentTarget.value)}
                        autoFocus
                      />
                      {omschrijving && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onMouseDown={e => { e.preventDefault(); updateOmschrijving('') }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label="Veld leegmaken"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className={`input-base !pr-7${colloError ? ' !border-red-400' : ''}`}
                    placeholder={placeholder}
                    value={omschrijving}
                    onChange={e => updateOmschrijving(e.currentTarget.value)}
                  />
                  {omschrijving && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={e => {
                        e.preventDefault()
                        updateOmschrijving('')
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="Veld leegmaken"
                    >
                      ✕
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      <PhotoUpload photos={entry.photos} onChange={updatePhotos} invalid={showErrors && entry.photos.length === 0} />
    </div>
  )
}
