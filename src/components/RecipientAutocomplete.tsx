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
  'nederland': 'NL', 'netherlands': 'NL', 'the netherlands': 'NL',
  'belgië': 'BE', 'belgie': 'BE', 'belgique': 'BE', 'belgium': 'BE',
  'duitsland': 'DE', 'germany': 'DE', 'deutschland': 'DE',
  'frankrijk': 'FR', 'france': 'FR',
  'luxemburg': 'LU', 'luxembourg': 'LU',
  'denemarken': 'DK', 'denmark': 'DK',
  'zweden': 'SE', 'sweden': 'SE',
  'noorwegen': 'NO', 'norway': 'NO',
  'zwitserland': 'CH', 'switzerland': 'CH', 'schweiz': 'CH',
  'oostenrijk': 'AT', 'austria': 'AT', 'österreich': 'AT',
  'spanje': 'ES', 'spain': 'ES', 'españa': 'ES',
  'italië': 'IT', 'italie': 'IT', 'italy': 'IT', 'italia': 'IT',
  'verenigd koninkrijk': 'GB', 'united kingdom': 'GB', 'engeland': 'GB',
  'polen': 'PL', 'poland': 'PL',
}

function countryToFlag(name: string): string {
  const code = COUNTRY_TO_CODE[name.toLowerCase().trim()]
  if (!code) return ''
  return code.replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))
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
  const listId = useId()

  // Sync externe waarde (bijv. bij reset)
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Herbereken suggesties bij querywijziging
  useEffect(() => {
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
            const flag = countryToFlag(option.land)
            const addressLine = buildAddressLine(option)
            const isActive = index === activeIndex
            return (
              <li
                key={option.id}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={isActive}
                className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer border-b border-gray-100 last:border-0 transition-colors ${
                  isActive ? 'bg-ef-blue-light' : 'hover:bg-gray-50'
                }`}
                onMouseDown={e => {
                  e.preventDefault() // Voorkom blur vóór click
                  selectOption(option)
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {/* Categoriebadge */}
                <span className={`flex-shrink-0 mt-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 leading-tight ${TAB_COLOR[option.type]}`}>
                  {TAB_LABEL[option.type]}
                </span>

                {/* Naam + adres */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{option.label}</p>
                  {(addressLine || option.land) && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                      {addressLine && <span className="truncate">{addressLine}</span>}
                      {option.land && (
                        <span className="flex-shrink-0 flex items-center gap-0.5">
                          {flag
                            ? <span title={option.land}>{flag}</span>
                            : <span className="text-gray-300">{option.land}</span>
                          }
                        </span>
                      )}
                    </p>
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
