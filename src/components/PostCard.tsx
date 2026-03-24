import { useState } from 'react'
import type { PostEntry, Photo } from '../types'
import PhotoUpload from './PhotoUpload'
import RecipientAutocomplete from './RecipientAutocomplete'
import type { RecipientOption } from '../services/googleSheetsService'
import { MESTKLANT_OPTIONS } from '../mestklantOptions'

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

  return (
    <div className={`card p-4 mb-3 transition-all ${entry.spoed ? 'border-l-4 border-l-ef-orange' : ''}`}>

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
            <span className="flex-shrink-0 text-[10px] font-bold text-ef-orange border border-ef-orange/40 bg-ef-orange-light rounded px-1.5 py-0.5">
              SPOED
            </span>
          )}
        </div>
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

      {/* Naam */}
      <div className="mb-3">
        <RecipientAutocomplete
          id={`name-${entry.id}`}
          value={entry.name}
          onChange={v => { set('name', v); if (!v) { set('shelf', null); set('spoed', false); set('colli', 1); set('recipientType', undefined); setAndersIndices(new Set()) } }}
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
          const placeholder = entry.recipientType === 'Mestklanten'
            ? (entry.colli > 1 ? `Omschrijving collo ${i + 1}` : 'Omschrijving collo')
            : (entry.colli > 1 ? `Omschrijving collo ${i + 1} (optioneel)` : 'Omschrijving collo (optioneel)')
          const colloError = showErrors && entry.recipientType === 'Mestklanten' && !omschrijving.trim()
          return (
            <div key={i} className="relative">
              {entry.recipientType === 'Mestklanten' ? (
                <div className="space-y-1">
                  <div className="relative">
                    <select
                      className={`input-base appearance-none !pr-7${colloError ? ' !border-red-400' : ''}`}
                      value={andersIndices.has(i) ? '__anders__' : omschrijving}
                      onChange={e => {
                        if (e.currentTarget.value === '__anders__') {
                          setAndersIndices(prev => new Set(prev).add(i))
                          updateOmschrijving('')
                        } else {
                          setAndersIndices(prev => { const s = new Set(prev); s.delete(i); return s })
                          updateOmschrijving(e.currentTarget.value)
                        }
                      }}
                      aria-label={placeholder}
                    >
                      <option value="" disabled>{placeholder}</option>
                      {MESTKLANT_OPTIONS.map(o => (
                        <option key={o.label} value={o.label}>{o.label}</option>
                      ))}
                      <option value="__anders__">Anders...</option>
                    </select>
                    {(omschrijving || andersIndices.has(i)) && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={e => {
                          e.preventDefault()
                          setAndersIndices(prev => { const s = new Set(prev); s.delete(i); return s })
                          updateOmschrijving('')
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Veld leegmaken"
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
