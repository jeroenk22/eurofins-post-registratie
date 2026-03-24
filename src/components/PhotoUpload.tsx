import { useRef, useState } from 'react'
import type { Photo } from '../types'
import { validateImageFiles, resizeAndEncode } from '../photoUtils'

interface PhotoUploadProps {
  photos: Photo[]
  onChange: (fn: (prev: Photo[]) => Photo[]) => void
  invalid?: boolean
}

export default function PhotoUpload({ photos, onChange, invalid }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState('')

  const handleFileArray = async (files: File[]) => {
    setUploadError('')
    try {
      validateImageFiles(files)
      const newPhotos = await Promise.all(files.map(resizeAndEncode))
      onChange(prev => [...prev, ...newPhotos])
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Ongeldig bestandstype.')
    }
  }

  const handleFiles = (files: FileList) => handleFileArray(Array.from(files))

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.items)
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length > 0) handleFileArray(files)
  }

  const openFilePicker = (e: React.MouseEvent) => {
    e.stopPropagation()
    inputRef.current?.click()
  }

  const remove = (id: string) => onChange(prev => prev.filter(p => p.id !== id))

  const borderClass = invalid ? 'border-red-400' : 'border-gray-200'

  return (
    <div>
      <p className="label-base">Foto's</p>

      {/* Mobiel: klik opent direct file dialog / camera */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`md:hidden w-full border-2 border-dashed rounded-lg p-3 flex items-center gap-2.5 text-left hover:border-ef-blue hover:bg-ef-blue-light transition-colors ${borderClass}`}
      >
        <span className="text-xl">📷</span>
        <span className="text-xs text-gray-500">Foto's toevoegen (meerdere mogelijk)</span>
      </button>

      {/* Desktop: paste-zone — klik om te focussen, dan Ctrl+V */}
      <div
        tabIndex={0}
        onPaste={handlePaste}
        className={`hidden md:flex w-full border-2 border-dashed rounded-lg p-3 items-center gap-2.5 cursor-default select-none hover:border-ef-blue hover:bg-ef-blue-light focus:border-ef-blue focus:bg-ef-blue-light focus:outline-none transition-colors ${borderClass}`}
      >
        <span className="text-xl">📋</span>
        <span className="flex-1 text-xs text-gray-500">Klik hier en plak screenshot (Ctrl+V)</span>
        <button
          type="button"
          onClick={openFilePicker}
          aria-label="Bestand uploaden"
          title="Bestand uploaden via bestandskiezer"
          className="text-gray-400 hover:text-ef-blue transition-colors p-1 rounded"
        >
          <span className="text-base">📁</span>
        </button>
      </div>

      {/* Gedeelde verborgen file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={e => e.target.files && handleFiles(e.target.files)}
        className="hidden"
      />

      {uploadError && (
        <p role="alert" className="mt-1.5 text-xs text-red-500">{uploadError}</p>
      )}

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
