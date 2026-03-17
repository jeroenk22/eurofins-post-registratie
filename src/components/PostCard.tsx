import type { PostEntry, Photo } from '../types'
import PhotoUpload from './PhotoUpload'
import RecipientAutocomplete from './RecipientAutocomplete'
import type { RecipientOption } from '../services/googleSheetsService'

const SHELVES = [1, 2, 3, 4, 5, 6, 7, 8] as const

interface PostCardProps {
  entry: PostEntry
  index: number
  onUpdate: (id: string, patch: Partial<PostEntry>) => void
  onRemove: (id: string) => void
  showRemove: boolean
  recipients: RecipientOption[]
}

export default function PostCard({ entry, index, onUpdate, onRemove, showRemove, recipients }: PostCardProps) {
  const set = <K extends keyof PostEntry>(key: K, val: PostEntry[K]) =>
    onUpdate(entry.id, { [key]: val } as Partial<PostEntry>)

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
          onChange={v => { set('name', v); if (!v) set('shelf', null) }}
          onSelect={option => {
            const n = Number(option.route)
            if (Number.isInteger(n) && n >= 1 && n <= 8) {
              set('shelf', n)
            } else {
              set('shelf', null)
            }
          }}
          recipients={recipients}
        />
      </div>

      {/* Schap selector */}
      <div className="mb-3">
        <p className="label-base">Schap nummer *</p>
        <div className="grid grid-cols-9 gap-1.5">
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
          className={`input-base mt-1.5${entry.shelf !== 'overig' ? ' hidden' : ''}`}
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

      <PhotoUpload photos={entry.photos} onChange={updatePhotos} />
    </div>
  )
}
