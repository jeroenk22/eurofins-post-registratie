import { useEffect, useState } from 'react'
import type { Photo } from '../types'
import { processFiles } from '../photoUtils'

interface MobileEntry {
  id: string
  name: string
}

interface Props {
  sessionId: string
}

export default function MobileCameraPage({ sessionId }: Props) {
  const [entries, setEntries] = useState<MobileEntry[]>([])
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Load session entries on mount, retry up to 5x (desktop may still be pushing)
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const tryFetch = async () => {
      try {
        const r = await fetch(`/.netlify/functions/session?id=${encodeURIComponent(sessionId)}`)
        if (!r.ok) {
          // HTTP-fout (bijv. 404): niet opnieuw proberen, direct foutmelding tonen
          if (!cancelled) {
            setLoadError('Sessie niet gevonden. Scan de QR-code opnieuw.')
            setLoading(false)
          }
          return
        }
        const data = await r.json()
        if (!cancelled) {
          setEntries(data.entries ?? [])
          setLoading(false)
        }
      } catch (e) {
        // Netwerkstoringen: retry tot 5x (desktop is mogelijk nog bezig met pushen)
        attempts++
        if (attempts < 5 && !cancelled) {
          setTimeout(tryFetch, 1500)
        } else if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Laad mislukt.')
          setLoading(false)
        }
      }
    }

    tryFetch()
    return () => { cancelled = true }
  }, [sessionId])

  const handleFiles = async (entryId: string, files: FileList) => {
    setUploadErrors(prev => ({ ...prev, [entryId]: '' }))
    try {
      const newPhotos = await processFiles(files)
      setPhotos(prev => ({ ...prev, [entryId]: [...(prev[entryId] ?? []), ...newPhotos] }))
    } catch (e) {
      setUploadErrors(prev => ({ ...prev, [entryId]: e instanceof Error ? e.message : 'Ongeldig bestand.' }))
    }
  }

  const removePhoto = (entryId: string, photoId: string) =>
    setPhotos(prev => ({ ...prev, [entryId]: (prev[entryId] ?? []).filter(p => p.id !== photoId) }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await Promise.all(
        entries.map(entry =>
          fetch('/.netlify/functions/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sessionId, entryId: entry.id, photos: photos[entry.id] ?? [] }),
          }).then(r => { if (!r.ok) throw new Error('Upload mislukt') }),
        ),
      )
      setSubmitted(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Uploaden mislukt.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Laden…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-red-100 max-w-sm w-full">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-sm text-red-600">{loadError}</p>
          <p className="text-xs text-gray-400 mt-2">Scan de QR-code opnieuw op de desktop.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-green-100 max-w-sm w-full">
          <p className="text-4xl mb-3">✅</p>
          <h2 className="font-bold text-gray-800 mb-2">Foto's geüpload!</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Je kunt dit scherm sluiten. De foto's worden nu automatisch getoond op de desktop.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-ef-blue text-white px-4 py-4 flex items-center gap-3">
        <span className="text-2xl">📷</span>
        <div>
          <h1 className="font-bold text-sm">Foto's toevoegen</h1>
          <p className="text-xs opacity-75">
            {entries.length} {entries.length === 1 ? 'zending' : 'zendingen'}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-8">
        {entries.map(entry => {
          const entryPhotos = photos[entry.id] ?? []
          return (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-gray-800 mb-3 truncate">
                {entry.name || '(geen naam)'}
              </h3>

              <label className="flex w-full border-2 border-dashed border-gray-200 rounded-lg p-3 items-center gap-2.5 cursor-pointer hover:border-ef-blue hover:bg-ef-blue-light transition-colors">
                <span className="text-xl">📷</span>
                <span className="text-xs text-gray-500">Foto's toevoegen (meerdere mogelijk)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={e => e.target.files && handleFiles(entry.id, e.target.files)}
                />
              </label>

              {uploadErrors[entry.id] && (
                <p role="alert" className="mt-1.5 text-xs text-red-500">{uploadErrors[entry.id]}</p>
              )}

              {entryPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {entryPhotos.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={p.data} alt={p.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(entry.id, p.id)}
                        aria-label="Verwijder foto"
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full text-white text-xs flex items-center justify-center transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {submitError && (
          <p role="alert" className="text-xs text-red-500 text-center">{submitError}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={`w-full py-3.5 rounded-xl text-white text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all ${
            submitting ? 'bg-ef-blue/60 cursor-not-allowed' : 'bg-ef-blue hover:bg-ef-blue/90 active:scale-[0.98]'
          }`}
        >
          {submitting ? '⏳ Uploaden…' : "📤 Foto's uploaden"}
        </button>
      </div>
    </div>
  )
}
