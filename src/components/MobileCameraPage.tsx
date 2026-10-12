import { useEffect, useState } from 'react'
import type { Photo } from '../types'
import { processFiles } from '../photoUtils'
import { loadPhotos, savePhotos, clearPhotos } from '../photoStorage'
import ScreenshotBadge from './ScreenshotBadge'

function LogoBar() {
  return (
    <div className="bg-white border-b border-gray-100 flex items-center justify-between px-4 py-3 gap-4">
      <img src="/miedema_logo.svg" alt="Miedema Ophaaldienst" className="h-8 w-auto object-contain" />
      <div className="h-8 w-px bg-gray-200 flex-shrink-0" />
      <img src="/eurofins_agro.svg" alt="Eurofins Agro" className="h-7 w-auto object-contain" />
    </div>
  )
}

interface MobileEntry {
  id: string
  name: string
  colli: number
  colliOmschrijvingen: string[]
  desktopPhotoCount: number
}

interface Props {
  sessionId: string
}

const ENTRIES_REFRESH_MS = 5000

/**
 * Staat gezet zolang de camera-app open is. Vinden we hem bij het laden van de
 * pagina terug, dan heeft de telefoon de browser intussen afgesloten (Android
 * doet dat bij weinig geheugen) en is de zojuist gemaakte foto nooit aangekomen.
 */
const cameraOpenKey = (sessionId: string) => `camera-open-${sessionId}`

/** Actuele zendingen van de desktop; `null` als dat nu niet lukt. */
async function fetchEntries(sessionId: string): Promise<MobileEntry[] | null> {
  try {
    const r = await fetch(`/.netlify/functions/session?id=${encodeURIComponent(sessionId)}`)
    if (!r.ok) return null
    const data = (await r.json()) as { entries?: MobileEntry[] }
    return data.entries ?? []
  } catch {
    return null
  }
}

export default function MobileCameraPage({ sessionId }: Props) {
  const [entries, setEntries] = useState<MobileEntry[]>([])
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(() => sessionStorage.getItem(`submitted-${sessionId}`) === '1')
  const [submitError, setSubmitError] = useState('')
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  // Zending waarvan de foto verloren ging doordat de pagina herlaadde terwijl de camera open was
  const [cameraLostEntryId, setCameraLostEntryId] = useState(() => sessionStorage.getItem(cameraOpenKey(sessionId)))

  // Terug uit de camera zonder herladen (ook bij annuleren): niets aan de hand
  useEffect(() => {
    sessionStorage.removeItem(cameraOpenKey(sessionId))
    const onVisible = () => {
      if (document.visibilityState === 'visible') sessionStorage.removeItem(cameraOpenKey(sessionId))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [sessionId])

  // Laad entries van de server
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const tryFetch = async () => {
      try {
        const r = await fetch(`/.netlify/functions/session?id=${encodeURIComponent(sessionId)}`)
        if (!r.ok) {
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

  // Houd de lijst bij: op de desktop kan intussen een zending verzonden zijn
  // (die moet hier verdwijnen) of een nieuwe zijn begonnen (die moet erbij).
  useEffect(() => {
    if (loading || loadError || submitted) return
    const refresh = async () => {
      const fresh = await fetchEntries(sessionId)
      if (fresh) setEntries(fresh)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = setInterval(refresh, ENTRIES_REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sessionId, loading, loadError, submitted])

  // Laad foto's uit IndexedDB bij mount
  useEffect(() => {
    loadPhotos(sessionId).then(setPhotos)
  }, [sessionId])

  const handleFiles = async (entryId: string, files: FileList) => {
    sessionStorage.removeItem(cameraOpenKey(sessionId))
    setCameraLostEntryId(null)
    setUploadErrors(prev => ({ ...prev, [entryId]: '' }))
    setProcessing(prev => ({ ...prev, [entryId]: true }))
    try {
      const newPhotos = await processFiles(files)
      // Gebruik functionele updater vanwege de await hierboven (prev is altijd actueel)
      setPhotos(prev => {
        const updated = { ...prev, [entryId]: [...(prev[entryId] ?? []), ...newPhotos] }
        void savePhotos(sessionId, updated)
        return updated
      })
    } catch (e) {
      setUploadErrors(prev => ({ ...prev, [entryId]: e instanceof Error ? e.message : 'Ongeldig bestand.' }))
    } finally {
      setProcessing(prev => ({ ...prev, [entryId]: false }))
    }
  }

  const removePhoto = (entryId: string, photoId: string) => {
    const updated = { ...photos, [entryId]: (photos[entryId] ?? []).filter(p => p.id !== photoId) }
    setPhotos(updated)
    void savePhotos(sessionId, updated)
  }

  const handleSubmit = async () => {
    setSubmitError('')
    // Vlak voor het uploaden: staan de zendingen nog open op de desktop? Een foto
    // bij een al verzonden zending zou daar stil verdwijnen.
    const fresh = await fetchEntries(sessionId)
    if (fresh) {
      const openIds = new Set(fresh.map(e => e.id))
      const verzonden = entries.filter(e => !openIds.has(e.id))
      setEntries(fresh)
      if (verzonden.length > 0) {
        const updated = { ...photos }
        verzonden.forEach(e => delete updated[e.id])
        setPhotos(updated)
        void savePhotos(sessionId, updated)
        setSubmitError(
          `Al verzonden op de desktop: ${verzonden.map(e => e.name || '(geen naam)').join(', ')}. ` +
            'Foto\'s voor deze zending kunnen niet meer worden toegevoegd.',
        )
        return
      }
    }
    const missing = entries.filter(
      entry => (photos[entry.id] ?? []).length === 0 && entry.desktopPhotoCount === 0
    )
    if (missing.length > 0) {
      setSubmitError(
        `Voeg minimaal 1 foto toe voor: ${missing.map(e => e.name || '(geen naam)').join(', ')}`
      )
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await Promise.all(
        entries.map(entry =>
          fetch('/.netlify/functions/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sessionId, entryId: entry.id, photos: photos[entry.id] ?? [] }),
          }).then(async r => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}))
              throw new Error(`Upload mislukt (${r.status}): ${body.error ?? 'onbekende fout'}`)
            }
          }),
        ),
      )
      sessionStorage.setItem(`submitted-${sessionId}`, '1')
      clearPhotos(sessionId)
      setSubmitted(true)
      // De lijst met zendingen kan lang zijn: het bevestigingsscherm begint bovenaan
      window.scrollTo(0, 0)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Uploaden mislukt.')
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-scherm bg-gray-50 flex flex-col">
        <LogoBar />
        <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-green-100 max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-mi-green-light border-2 border-mi-green flex items-center justify-center text-3xl mb-5 text-mi-green mx-auto">
            ✓
          </div>
          <h2 className="font-bold text-gray-800 mb-2">Foto's geüpload!</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            De foto's worden automatisch getoond op de desktop.
          </p>
          <button
            type="button"
            onClick={() => window.close()}
            className="w-full py-3 rounded-xl bg-ef-blue text-white text-sm font-bold hover:bg-ef-blue/90 active:scale-[0.98] transition-all mb-3"
          >
            Tabblad sluiten
          </button>
          <p className="text-xs text-gray-400">
            Lukt dat niet? Sluit dit tabblad dan handmatig.
          </p>
        </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-scherm bg-gray-50 flex flex-col">
        <LogoBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">Laden…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-scherm bg-gray-50 flex flex-col">
        <LogoBar />
        <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-red-100 max-w-sm w-full">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-sm text-red-600">{loadError}</p>
          <p className="text-xs text-gray-400 mt-2">Scan de QR-code opnieuw op de desktop.</p>
        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-scherm bg-gray-50">
      <LogoBar />
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
        {entries.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            Er staan geen open zendingen op de desktop. Kies op de desktop een ontvanger; die verschijnt hier vanzelf.
          </p>
        )}
        {entries.map(entry => {
          const entryPhotos = photos[entry.id] ?? []
          return (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-gray-800 truncate">
                {entry.name || '(geen naam)'}
              </h3>
              <div className="text-xs text-gray-400 mb-3">
                <span>{entry.colli} {entry.colli === 1 ? 'collo' : 'colli'}</span>
                {entry.desktopPhotoCount > 0 && (
                  <span className="ml-2 text-green-600">
                    · Reeds {entry.desktopPhotoCount} {entry.desktopPhotoCount === 1 ? "foto" : "foto's"} geüpload via desktop
                  </span>
                )}
                {(entry.colliOmschrijvingen ?? []).some(o => o) && (
                  <ul className="mt-1 space-y-0.5">
                    {(entry.colliOmschrijvingen ?? []).map((omschrijving, i) =>
                      omschrijving ? (
                        <li key={i}>Collo {i + 1}: {omschrijving}</li>
                      ) : null
                    )}
                  </ul>
                )}
              </div>

              {/* Twee bronnen: met `capture` opent de camera direct, zonder kies je bestaande foto's */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center justify-center gap-1 rounded-lg p-3 bg-ef-blue text-white cursor-pointer hover:bg-ef-blue/90 active:scale-[0.98] transition-all">
                  <span className="text-2xl">📷</span>
                  <span className="text-xs font-semibold">Foto maken</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onClick={() => sessionStorage.setItem(cameraOpenKey(sessionId), entry.id)}
                    onChange={e => e.target.files && handleFiles(entry.id, e.target.files)}
                  />
                </label>
                <label className="flex flex-col items-center justify-center gap-1 rounded-lg p-3 border-2 border-ef-blue text-ef-blue bg-white cursor-pointer hover:bg-ef-blue-light active:scale-[0.98] transition-all">
                  <span className="text-2xl">🖼️</span>
                  <span className="text-xs font-semibold">Kies uit galerij</span>
                  <span className="text-[10px] text-gray-500">meerdere mogelijk</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => e.target.files && handleFiles(entry.id, e.target.files)}
                  />
                </label>
              </div>

              {cameraLostEntryId === entry.id && (
                <p role="alert" className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                  Je telefoon heeft de pagina opnieuw geladen terwijl de camera openstond, daardoor is de foto
                  niet aangekomen. Maak de foto opnieuw. Gebeurt dit vaak? Maak de foto dan eerst met de
                  camera-app en kies hem hier via <strong>Kies uit galerij</strong>.
                </p>
              )}

              {processing[entry.id] && (
                <p className="mt-2 text-xs text-gray-500">⏳ Foto verwerken…</p>
              )}

              {uploadErrors[entry.id] && (
                <p role="alert" className="mt-1.5 text-xs text-red-500">{uploadErrors[entry.id]}</p>
              )}

              {entryPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {entryPhotos.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={p.data} alt={p.name} className="w-full h-full object-cover" />
                      <ScreenshotBadge photo={p} />
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
