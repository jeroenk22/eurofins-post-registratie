import { useRef } from 'react'
import type { Photo } from '../types'
import { processFiles } from '../photoUtils'

interface PhotoUploadProps {
  photos: Photo[]
  onChange: (fn: (prev: Photo[]) => Photo[]) => void
}

export default function PhotoUpload({ photos, onChange }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    const newPhotos = await processFiles(files)
    onChange(prev => [...prev, ...newPhotos])
  }

  const remove = (id: string) => onChange(prev => prev.filter(p => p.id !== id))

  return (
    <div>
      <p className="label-base">Foto's</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-200 rounded-lg p-3 flex items-center gap-2.5 text-left hover:border-ef-blue hover:bg-ef-blue-light transition-colors"
      >
        <span className="text-xl">📷</span>
        <span className="text-xs text-gray-500">Foto's toevoegen (meerdere mogelijk)</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={e => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
      </button>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {photos.map(p => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img src={p.data} alt={p.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(p.id)}
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
}
