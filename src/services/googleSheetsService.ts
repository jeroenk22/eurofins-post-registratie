export type SheetTab = 'Monsternemers' | 'AP06' | 'Mestklanten'

export interface RecipientOption {
  id: string
  type: SheetTab
  label: string       // Getoond in de dropdown
  value: string       // Ingevuld in het veld bij selectie
  searchTerms: string[] // Zoekvelden: Code, Voornaam, Achternaam, Postcode, Plaats
  adres: string
  postcode: string
  plaats: string
  land: string
  route: string  // Waarde uit de kolom 'Route' in de sheet, gebruikt als schapnummer
}

interface PersonRow {
  Code: string
  Voornaam: string
  Tussenvoegsel: string
  Achternaam: string
  Adres: string
  Postcode: string
  Plaats: string
  Land: string
  Route?: string
}

interface MestklantRow {
  Naam: string
  Adres: string
  Postcode: string
  Plaats: string
  Land: string
  Route?: string
}

const CACHE_KEY = 'recipient_data_cache'
const CACHE_TTL_MS = 10 * 60 * 1000

export function isGoogleSheetsConfigured(): boolean {
  return true // Configuratie wordt server-side afgehandeld via Netlify Function
}

export function formatPersonName(row: Pick<PersonRow, 'Code' | 'Voornaam' | 'Tussenvoegsel' | 'Achternaam'>): string {
  const nameParts = [row.Voornaam, row.Tussenvoegsel, row.Achternaam].filter(Boolean)
  const fullName = nameParts.join(' ')
  return row.Code ? `${row.Code} - ${fullName}` : fullName
}

async function fetchSheetTab(tabName: string): Promise<string[][]> {
  const url = `/.netlify/functions/sheets?tab=${encodeURIComponent(tabName)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fout bij ophalen tabblad '${tabName}': HTTP ${response.status}`)
  }
  const data = await response.json()
  return (data.values ?? []) as string[][]
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const [headers, ...dataRows] = rows
  return dataRows.map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
}

export function parsePersonRows(rows: string[][], type: 'Monsternemers' | 'AP06'): RecipientOption[] {
  return rowsToObjects(rows)
    .map((obj, index) => {
      const p = obj as unknown as PersonRow
      const name = formatPersonName(p)
      const value = p.Plaats ? `${name} (${p.Plaats})` : name
      const label = value
      const searchTerms = [p.Code, p.Voornaam, p.Achternaam, p.Postcode, p.Plaats].filter(Boolean)
      return {
        id: `${type}-${index}`,
        type,
        label,
        value,
        searchTerms,
        adres: p.Adres ?? '',
        postcode: p.Postcode ?? '',
        plaats: p.Plaats ?? '',
        land: p.Land ?? '',
        route: p.Route ?? '',
      } satisfies RecipientOption
    })
    .filter(r => r.searchTerms.length > 0)
}

export function parseMestklantRows(rows: string[][]): RecipientOption[] {
  return rowsToObjects(rows)
    .map((obj, index) => {
      const m = obj as unknown as MestklantRow
      const searchTerms = [m.Naam, m.Postcode, m.Plaats].filter(Boolean)
      return {
        id: `Mestklanten-${index}`,
        type: 'Mestklanten' as const,
        label: m.Naam,
        value: m.Naam,
        searchTerms,
        adres: m.Adres ?? '',
        postcode: m.Postcode ?? '',
        plaats: m.Plaats ?? '',
        land: m.Land ?? '',
        route: m.Route ?? '',
      } satisfies RecipientOption
    })
    .filter(r => r.searchTerms.length > 0)
}

export async function fetchAllRecipients(): Promise<RecipientOption[]> {
  const [monsternemersRows, ap06Rows, mestklantRows] = await Promise.all([
    fetchSheetTab('Monsternemers'),
    fetchSheetTab('AP06'),
    fetchSheetTab('Mestklanten'),
  ])
  return [
    ...parsePersonRows(monsternemersRows, 'Monsternemers'),
    ...parsePersonRows(ap06Rows, 'AP06'),
    ...parseMestklantRows(mestklantRows),
  ]
}

interface CacheEntry {
  data: RecipientOption[]
  timestamp: number
}

export function loadCachedRecipients(): RecipientOption[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache: CacheEntry = JSON.parse(raw)
    return cache.data
  } catch {
    return null
  }
}

export function saveRecipientsToCache(data: RecipientOption[]): void {
  try {
    const cache: CacheEntry = { data, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage kan niet beschikbaar zijn (bijv. in private modus)
  }
}

export function isCacheStale(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return true
    const cache: CacheEntry = JSON.parse(raw)
    return Date.now() - cache.timestamp > CACHE_TTL_MS
  } catch {
    return true
  }
}

export function filterRecipients(recipients: RecipientOption[], query: string): RecipientOption[] {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return []
  const words = q.split(/\s+/)
  return recipients
    .filter(r => {
      const searchable = [r.label, ...r.searchTerms].join(' ').toLowerCase()
      return words.every(word => searchable.includes(word))
    })
    .slice(0, 10)
}
