import { useEffect } from 'react'
import type { Photo } from '../types'

interface PhotoLightboxProps {
  photos: Photo[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onRemove: (id: string) => void
}

/**
 * Foto groot bekijken (desktop). Sluiten met ✕, Escape of een klik naast de foto;
 * bladeren met de pijlen of de pijltjestoetsen.
 */
export default function PhotoLightbox({ photos, index, onIndexChange, onClose, onRemove }: PhotoLightboxProps) {
  const photo = photos[index]
  const meer = photos.length > 1
  const vorige = () => onIndexChange((index - 1 + photos.length) % photos.length)
  const volgende = () => onIndexChange((index + 1) % photos.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && meer) vorige()
      else if (e.key === 'ArrowRight' && meer) volgende()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!photo) return null

  const knop = 'flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto bekijken"
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-6"
    >
      <img
        src={photo.data}
        alt={photo.name}
        onClick={e => e.stopPropagation()}
        className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl bg-white"
      />

      <div onClick={e => e.stopPropagation()} className="mt-4 flex items-center gap-3 text-white text-sm">
        {meer && <span className="tabular-nums opacity-80">{index + 1} / {photos.length}</span>}
        <button
          type="button"
          onClick={() => onRemove(photo.id)}
          className="rounded-lg bg-white/15 hover:bg-red-500/80 px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          🗑 Verwijder foto
        </button>
      </div>

      {meer && (
        <>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); vorige() }}
            aria-label="Vorige foto"
            className={`${knop} absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 text-2xl`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); volgende() }}
            aria-label="Volgende foto"
            className={`${knop} absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 text-2xl`}
          >
            ›
          </button>
        </>
      )}

      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClose() }}
        aria-label="Sluiten"
        className={`${knop} absolute top-4 right-4 w-9 h-9 text-lg`}
      >
        ✕
      </button>
    </div>
  )
}
