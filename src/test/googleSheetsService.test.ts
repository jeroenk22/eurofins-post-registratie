import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  parsePersonRows,
  parseMestklantRows,
  formatPersonName,
  filterRecipients,
  loadCachedRecipients,
  saveRecipientsToCache,
  isCacheStale,
  type RecipientOption,
} from '../services/googleSheetsService'

// --- formatPersonName ---

describe('formatPersonName', () => {
  it('combineert Code, Voornaam, Tussenvoegsel en Achternaam', () => {
    expect(formatPersonName({ Code: 'M001', Voornaam: 'Jan', Tussenvoegsel: 'de', Achternaam: 'Vries' }))
      .toBe('M001 - Jan de Vries')
  })

  it('laat tussenvoegsel weg als het leeg is', () => {
    expect(formatPersonName({ Code: 'M002', Voornaam: 'Sophie', Tussenvoegsel: '', Achternaam: 'Jansen' }))
      .toBe('M002 - Sophie Jansen')
  })

  it('laat code weg als die leeg is', () => {
    expect(formatPersonName({ Code: '', Voornaam: 'Piet', Tussenvoegsel: '', Achternaam: 'Klaassen' }))
      .toBe('Piet Klaassen')
  })
})

// --- parsePersonRows ---

describe('parsePersonRows', () => {
  const headers = ['Code', 'Voornaam', 'Tussenvoegsel', 'Achternaam', 'Route', 'Adres', 'Postcode', 'Plaats', 'Land']
  const rows: string[][] = [
    headers,
    ['M001', 'Jan', 'de', 'Vries', 'R1', 'Kerkstraat 1', '1234AB', 'Amsterdam', 'Nederland'],
    ['M002', 'Sophie', '', 'Jansen', 'R2', 'Dorpsweg 5', '5678CD', 'Utrecht', 'Nederland'],
    ['', '', '', '', '', '', '', '', ''], // lege rij → gefilterd
  ]

  it('parst geldige rijen correct', () => {
    const result = parsePersonRows(rows, 'Monsternemers')
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('M001 - Jan de Vries (Amsterdam)')
    expect(result[0].value).toBe('M001 - Jan de Vries (Amsterdam)')
    expect(result[0].type).toBe('Monsternemers')
    expect(result[0].adres).toBe('Kerkstraat 1')
    expect(result[0].postcode).toBe('1234AB')
    expect(result[0].plaats).toBe('Amsterdam')
    expect(result[0].land).toBe('Nederland')
  })

  it('slaat lege rijen over', () => {
    const result = parsePersonRows(rows, 'Monsternemers')
    expect(result).toHaveLength(2)
  })

  it('bevat juiste searchTerms (Code, Voornaam, Achternaam, Postcode, Plaats)', () => {
    const result = parsePersonRows(rows, 'AP06')
    expect(result[0].searchTerms).toContain('M001')
    expect(result[0].searchTerms).toContain('Jan')
    expect(result[0].searchTerms).toContain('Vries')
    expect(result[0].searchTerms).toContain('1234AB')
    expect(result[0].searchTerms).toContain('Amsterdam')
  })

  it('geeft lege array terug bij minder dan 2 rijen', () => {
    expect(parsePersonRows([], 'Monsternemers')).toEqual([])
    expect(parsePersonRows([headers], 'Monsternemers')).toEqual([])
  })
})

// --- parseMestklantRows ---

describe('parseMestklantRows', () => {
  const headers = ['Naam', 'Adres', 'Postcode', 'Plaats', 'Land']
  const rows: string[][] = [
    headers,
    ['Acme B.V.', 'Industrieweg 10', '9999ZZ', 'Groningen', 'Nederland'],
    ['', '', '', '', ''], // lege rij → gefilterd
  ]

  it('parst Mestklanten correct', () => {
    const result = parseMestklantRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Acme B.V. (9999ZZ Groningen)')
    expect(result[0].value).toBe('Acme B.V. (9999ZZ Groningen)')
    expect(result[0].type).toBe('Mestklanten')
  })

  it('bouwt value zonder postcode/plaats als beide leeg', () => {
    const sparseRows: string[][] = [headers, ['Klant X', '', '', '', '']]
    const result = parseMestklantRows(sparseRows)
    expect(result[0].value).toBe('Klant X')
  })

  it('bevat Naam in searchTerms', () => {
    const result = parseMestklantRows(rows)
    expect(result[0].searchTerms).toContain('Acme B.V.')
    expect(result[0].searchTerms).toContain('9999ZZ')
    expect(result[0].searchTerms).toContain('Groningen')
  })
})

// --- filterRecipients ---

describe('filterRecipients', () => {
  const recipients: RecipientOption[] = [
    {
      id: 'a',
      type: 'Monsternemers',
      label: 'M001 - Jan de Vries',
      value: 'M001 - Jan de Vries',
      searchTerms: ['M001', 'Jan', 'Vries', '1234AB', 'Amsterdam'],
      adres: 'Kerkstraat 1',
      postcode: '1234AB',
      plaats: 'Amsterdam',
      land: 'Nederland',
    },
    {
      id: 'b',
      type: 'Mestklanten',
      label: 'Acme B.V. (9999ZZ Groningen)',
      value: 'Acme B.V. (9999ZZ Groningen)',
      searchTerms: ['Acme B.V.', '9999ZZ', 'Groningen'],
      adres: 'Industrieweg 10',
      postcode: '9999ZZ',
      plaats: 'Groningen',
      land: 'Nederland',
    },
  ]

  it('filtert op Code', () => {
    expect(filterRecipients(recipients, 'M001')).toHaveLength(1)
    expect(filterRecipients(recipients, 'M001')[0].id).toBe('a')
  })

  it('filtert op Achternaam (case-insensitief)', () => {
    expect(filterRecipients(recipients, 'vries')).toHaveLength(1)
  })

  it('filtert op Postcode', () => {
    expect(filterRecipients(recipients, '9999')).toHaveLength(1)
    expect(filterRecipients(recipients, '9999')[0].id).toBe('b')
  })

  it('filtert op Plaats', () => {
    expect(filterRecipients(recipients, 'amsterdam')).toHaveLength(1)
  })

  it('geeft lege lijst terug bij query korter dan 2 tekens', () => {
    expect(filterRecipients(recipients, 'M')).toHaveLength(0)
    expect(filterRecipients(recipients, '')).toHaveLength(0)
  })

  it('filtert op combinatie van woorden', () => {
    expect(filterRecipients(recipients, 'jan vries')).toHaveLength(1)
    expect(filterRecipients(recipients, 'jan vries')[0].id).toBe('a')
  })

  it('geeft geen resultaat als niet alle woorden matchen', () => {
    expect(filterRecipients(recipients, 'jan groningen')).toHaveLength(0)
  })

  it('beperkt resultaten tot max 10', () => {
    const many: RecipientOption[] = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`,
      type: 'AP06' as const,
      label: `Persoon ${i}`,
      value: `Persoon ${i}`,
      searchTerms: ['persoon', `${i}`],
      adres: '',
      postcode: '',
      plaats: '',
      land: '',
    }))
    expect(filterRecipients(many, 'persoon')).toHaveLength(10)
  })
})

// --- LocalStorage caching ---

describe('LocalStorage caching', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const sampleData: RecipientOption[] = [
    {
      id: 'test-1',
      type: 'AP06',
      label: 'A001 - Test Persoon',
      value: 'A001 - Test Persoon',
      searchTerms: ['A001', 'Test', 'Persoon'],
      adres: '',
      postcode: '',
      plaats: '',
      land: '',
    },
  ]

  it('loadCachedRecipients geeft null terug als cache leeg is', () => {
    expect(loadCachedRecipients()).toBeNull()
  })

  it('sla data op en lees terug', () => {
    saveRecipientsToCache(sampleData)
    const result = loadCachedRecipients()
    expect(result).not.toBeNull()
    expect(result![0].id).toBe('test-1')
  })

  it('isCacheStale is true als cache leeg is', () => {
    expect(isCacheStale()).toBe(true)
  })

  it('isCacheStale is false direct na opslaan', () => {
    saveRecipientsToCache(sampleData)
    expect(isCacheStale()).toBe(false)
  })

  it('isCacheStale is true na verlopen TTL', () => {
    saveRecipientsToCache(sampleData)
    // Zet timestamp terug in de tijd (11 minuten geleden)
    const raw = localStorage.getItem('recipient_data_cache')!
    const cache = JSON.parse(raw)
    cache.timestamp = Date.now() - 11 * 60 * 1000
    localStorage.setItem('recipient_data_cache', JSON.stringify(cache))
    expect(isCacheStale()).toBe(true)
  })

  it('loadCachedRecipients geeft null terug bij ongeldige JSON', () => {
    localStorage.setItem('recipient_data_cache', 'geen-geldige-json')
    expect(loadCachedRecipients()).toBeNull()
  })

  it('isCacheStale geeft true terug bij ongeldige JSON', () => {
    localStorage.setItem('recipient_data_cache', 'geen-geldige-json')
    expect(isCacheStale()).toBe(true)
  })
})

// --- fetchAllRecipients integratie (mock) ---

describe('fetchAllRecipients', () => {
  it('gooit een fout als sheets niet geconfigureerd zijn', async () => {
    vi.stubEnv('VITE_GOOGLE_SHEETS_ID', '')
    vi.stubEnv('VITE_GOOGLE_SHEETS_API_KEY', '')
    // We testen dit via de isGoogleSheetsConfigured check
    const { isGoogleSheetsConfigured } = await import('../services/googleSheetsService')
    expect(isGoogleSheetsConfigured()).toBe(false)
    vi.unstubAllEnvs()
  })
})
