import { useState, useRef, useEffect } from 'react'
import { MESTKLANT_OPTIONS } from '../mestklantOptions'

interface MestklantSelectProps {
  value: string
  isAnders: boolean
  onChange: (val: string) => void
  onClear: () => void
  onSelectAnders: () => void
  placeholder: string
  invalid: boolean
}

export default function MestklantSelect({ value, isAnders, onChange, onClear, onSelectAnders, placeholder, invalid }: MestklantSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [open])

  const hasValue = isAnders || !!value
  const displayValue = isAnders ? 'Anders...' : value

  return (
    <div ref={ref} className="relative">
      {/* Verborgen native select voor toegankelijkheid en tests */}
      <select
        aria-label={placeholder}
        value={isAnders ? '__anders__' : value}
        onChange={e => {
          if (e.currentTarget.value === '__anders__') {
            onSelectAnders()
          } else {
            onChange(e.currentTarget.value)
          }
        }}
        className={`sr-only${invalid ? ' border-red-400' : ''}`}
        tabIndex={-1}
      >
        <option value="" disabled>{placeholder}</option>
        {MESTKLANT_OPTIONS.map(o => (
          <option key={o.label} value={o.label}>{o.label}</option>
        ))}
        <option value="__anders__">Anders...</option>
      </select>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 input-base text-left${invalid ? ' !border-red-400' : ''}${hasValue ? ' !pr-7' : ''}`}
      >
        <span className={`truncate ${displayValue ? 'text-gray-700' : 'text-gray-400'}`}>
          {displayValue || placeholder}
        </span>
        {!hasValue && (
          <svg
            className={`shrink-0 w-4 h-4 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20" fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {hasValue && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); onClear() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Veld leegmaken"
        >
          ✕
        </button>
      )}

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {MESTKLANT_OPTIONS.map(o => (
            <li key={o.label}>
              <button
                type="button"
                onClick={() => { onChange(o.label); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  value === o.label && !isAnders
                    ? 'bg-ef-blue text-white font-semibold'
                    : 'text-gray-700 hover:bg-ef-blue-light'
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => { onSelectAnders(); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                isAnders
                  ? 'bg-ef-blue text-white font-semibold'
                  : 'text-gray-700 hover:bg-ef-blue-light'
              }`}
            >
              Anders...
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
