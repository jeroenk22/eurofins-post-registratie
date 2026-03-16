import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { filterRecipients, type RecipientOption, type SheetTab } from '../services/googleSheetsService'

interface RecipientAutocompleteProps {
  id: string
  value: string
  onChange: (value: string) => void
  recipients: RecipientOption[]
}

const TAB_LABEL: Record<SheetTab, string> = {
  Monsternemers: 'Monsternemer',
  AP06: 'AP06',
  Mestklanten: 'Mestklant',
}

const TAB_COLOR: Record<SheetTab, string> = {
  Monsternemers: 'bg-ef-blue text-white',
  AP06: 'bg-mi-green text-white',
  Mestklanten: 'bg-gray-500 text-white',
}

// ISO-3166-1 alpha-2 mapping voor veelvoorkomende landen in NL-context
const COUNTRY_TO_CODE: Record<string, string> = {
  'nederland': 'nl', 'netherlands': 'nl', 'the netherlands': 'nl',
  'belgië': 'be', 'belgie': 'be', 'belgique': 'be', 'belgium': 'be',
  'duitsland': 'de', 'germany': 'de', 'deutschland': 'de',
  'frankrijk': 'fr', 'france': 'fr',
  'luxemburg': 'lu', 'luxembourg': 'lu',
  'denemarken': 'dk', 'denmark': 'dk',
  'zweden': 'se', 'sweden': 'se',
  'noorwegen': 'no', 'norway': 'no',
  'zwitserland': 'ch', 'switzerland': 'ch', 'schweiz': 'ch',
  'oostenrijk': 'at', 'austria': 'at', 'österreich': 'at',
  'spanje': 'es', 'spain': 'es', 'españa': 'es',
  'italië': 'it', 'italie': 'it', 'italy': 'it', 'italia': 'it',
  'verenigd koninkrijk': 'gb', 'united kingdom': 'gb', 'engeland': 'gb',
  'polen': 'pl', 'poland': 'pl',
}

function CountryFlag({ name }: { name: string }) {
  const code = COUNTRY_TO_CODE[name.toLowerCase().trim()]
  if (!code) return <span className="text-gray-300 text-xs">{name}</span>
  return (
    <img
      src={`https://flagcdn.com/w20/${code}.png`}
      width="16"
      height="12"
      alt={name}
      title={name}
      className="inline-block rounded-sm align-middle"
    />
  )
}

function buildAddressLine(option: RecipientOption): string {
  const city = [option.postcode, option.plaats].filter(Boolean).join(' ')
  return [option.adres, city].filter(Boolean).join(', ')
}

export default function RecipientAutocomplete({ id, value, onChange, recipients }: RecipientAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<RecipientOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const justSelectedRef = useRef(false)
  const listId = useId()

  // Sync externe waarde (bijv. bij reset)
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Herbereken suggesties bij querywijziging
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }
    const results = filterRecipients(recipients, query)
    setSuggestions(results)
    setIsOpen(results.length > 0)
    setActiveIndex(-1)
  }, [query, recipients])

  // Sluit dropdown bij klik buiten het component
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectOption = useCallback((option: RecipientOption) => {
    justSelectedRef.current = true
    onChange(option.value)
    setQuery(option.value)
    setIsOpen(false)
    setSuggestions([])
  }, [onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      selectOption(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="label-base">
        Naam / Bedrijf ontvanger *
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        className="input-base"
        placeholder="bijv. Jan de Vries of Acme B.V."
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setIsOpen(true) }}
        autoComplete="off"
        autoCorrect="off"
      />

      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Ontvanger suggesties"
          className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-h-72 overflow-y-auto"
        >
          {suggestions.map((option, index) => {
            const addressLine = buildAddressLine(option)
            const isActive = index === activeIndex
            return (
              <li
                key={option.id}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={isActive}
                className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2.5 px-3 py-2.5 cursor-pointer border-b border-gray-100 last:border-0 transition-colors ${
                  isActive ? 'bg-ef-blue-light' : 'hover:bg-gray-50'
                }`}
                onMouseDown={e => {
                  e.preventDefault() // Voorkom blur vóór click
                  selectOption(option)
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {/* Categoriebadge + vlag (op mobile naast elkaar) */}
                <div className="flex items-center justify-between sm:block">
                  <span className={`sm:w-24 flex-shrink-0 sm:mt-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 leading-tight text-center ${TAB_COLOR[option.type]}`}>
                    {TAB_LABEL[option.type]}
                  </span>
                  {option.land && (
                    <span className="sm:hidden flex-shrink-0 flex items-center self-stretch">
                      <CountryFlag name={option.land} />
                    </span>
                  )}
                </div>

                {/* Naam + adres */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-800 sm:truncate flex-1">{option.label}</p>
                    {option.land && (
                      <span className="hidden sm:inline flex-shrink-0">
                        <CountryFlag name={option.land} />
                      </span>
                    )}
                  </div>
                  {addressLine && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{addressLine}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
