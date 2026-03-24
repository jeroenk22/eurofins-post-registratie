import { describe, it, expect } from 'vitest'
import type { PostEntry } from '../types'
import { validateForm, isValidEmail } from '../validation'

const mockPhoto = { id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }

const validEntry = (): PostEntry => ({
  id: '1', shelf: 3, shelfDescription: '', name: 'Acme', adres: '', postcode: '', plaats: '', land: '', colli: 1, colliOmschrijvingen: [], spoed: false, photos: [mockPhoto],
})

describe('validateForm', () => {
  it('passes when all required fields are filled', () => {
    expect(validateForm([validEntry()], 'Sophie', '')).toBeNull()
  })

  it('fails when an entry has no shelf selected', () => {
    const entry = { ...validEntry(), shelf: null }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/schap nummer/)
  })

  it('fails when an entry has an empty name', () => {
    const entry = { ...validEntry(), name: '' }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/naam of bedrijf/)
  })

  it('fails when entry name is only whitespace', () => {
    const entry = { ...validEntry(), name: '   ' }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/naam of bedrijf/)
  })

  it('fails when an entry has no photos', () => {
    const entry = { ...validEntry(), photos: [] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/minimaal 1 foto/)
  })

  it('fails when sender name is empty', () => {
    expect(validateForm([validEntry()], '', '')).toMatch(/Vul je naam in/)
  })

  it('fails when sender name is only whitespace', () => {
    expect(validateForm([validEntry()], '   ', '')).toMatch(/Vul je naam in/)
  })

  it('checks all entries — fails on second entry missing shelf', () => {
    const entries = [validEntry(), { ...validEntry(), id: '2', shelf: null }]
    expect(validateForm(entries, 'Sophie', '')).toMatch(/schap nummer/)
  })

  it('shelf validation takes priority over name validation', () => {
    const entry = { ...validEntry(), shelf: null, name: '' }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/schap nummer/)
  })

  it('fails when shelf is overig but description is empty', () => {
    const entry = { ...validEntry(), shelf: 'overig' as const, shelfDescription: '' }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/Beschrijf waar/)
  })

  it('fails when shelf is overig but description is only whitespace', () => {
    const entry = { ...validEntry(), shelf: 'overig' as const, shelfDescription: '   ' }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/Beschrijf waar/)
  })

  it('passes when shelf is overig with a valid description', () => {
    const entry = { ...validEntry(), shelf: 'overig' as const, shelfDescription: 'Ligt op kar naast de stelling' }
    expect(validateForm([entry], 'Sophie', '')).toBeNull()
  })

  it('passes when email is empty (optional)', () => {
    expect(validateForm([validEntry()], 'Sophie', '')).toBeNull()
  })

  it('passes when email is valid', () => {
    expect(validateForm([validEntry()], 'Sophie', 'sophie@example.com')).toBeNull()
  })

  it('fails when email is filled but invalid', () => {
    expect(validateForm([validEntry()], 'Sophie', 'geen-email')).toMatch(/geldig e-mailadres/)
  })

  it('fails when email has no domain', () => {
    expect(validateForm([validEntry()], 'Sophie', 'sophie@')).toMatch(/geldig e-mailadres/)
  })

  it('trims email before validating', () => {
    expect(validateForm([validEntry()], 'Sophie', '  sophie@example.com  ')).toBeNull()
  })
})

describe('validateForm — mestklant colli omschrijvingen verplicht', () => {
  const mestklantEntry = (): PostEntry => ({
    ...validEntry(),
    recipientType: 'Mestklanten',
    colliOmschrijvingen: ['Doos deksels'],
  })

  it('geeft geen fout als mestklant 1 collo heeft met omschrijving', () => {
    expect(validateForm([mestklantEntry()], 'Sophie', '')).toBeNull()
  })

  it('geeft fout als mestklant collo geen omschrijving heeft', () => {
    const entry = { ...mestklantEntry(), colliOmschrijvingen: [] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('geeft fout als mestklant collo alleen whitespace heeft', () => {
    const entry = { ...mestklantEntry(), colliOmschrijvingen: ['   '] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('geeft fout als mestklant colli=2 heeft maar slechts 1 omschrijving ingevuld', () => {
    const entry = { ...mestklantEntry(), colli: 2, colliOmschrijvingen: ['Doos deksels', ''] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('geeft geen fout als mestklant colli=2 heeft en beide omschrijvingen ingevuld', () => {
    const entry = { ...mestklantEntry(), colli: 2, colliOmschrijvingen: ['Doos deksels', 'Doosje sealrollen'] }
    expect(validateForm([entry], 'Sophie', '')).toBeNull()
  })

  it('geeft geen fout voor niet-mestklant met lege omschrijvingen', () => {
    const entry = { ...validEntry(), colliOmschrijvingen: [] }
    expect(validateForm([entry], 'Sophie', '')).toBeNull()
  })

  it('geeft geen fout voor entry zonder recipientType met lege omschrijvingen', () => {
    const entry = { ...validEntry(), recipientType: undefined, colliOmschrijvingen: [] }
    expect(validateForm([entry], 'Sophie', '')).toBeNull()
  })

  it('mestklant omschrijving-fout gaat vóór foto-fout', () => {
    const entry = { ...mestklantEntry(), colliOmschrijvingen: [], photos: [] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('alle TMS-waarden zijn geldige omschrijvingen', () => {
    const tmsValues = [
      'Doos deksels',
      'Doosje sealrollen',
      'Grote doos sealrollen (10 doosjes)',
      'Setje vaste mestzakken (50 stuks)',
      'Grote doos vaste mestzakken (500 stuks)',
    ]
    for (const value of tmsValues) {
      const entry = { ...mestklantEntry(), colliOmschrijvingen: [value] }
      expect(validateForm([entry], 'Sophie', ''), `TMS-waarde "${value}" moet geldig zijn`).toBeNull()
    }
  })

  it('bij meerdere entries geeft fout als één mestklant-entry ontbreekt omschrijving', () => {
    const entries = [
      validEntry(),
      { ...mestklantEntry(), id: '2', colliOmschrijvingen: [] },
    ]
    expect(validateForm(entries, 'Sophie', '')).toMatch(/omschrijving/)
  })
})

describe('isValidEmail', () => {
  it('accepts a standard email address', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(isValidEmail('test@mail.example.com')).toBe(true)
  })

  it('rejects email without @', () => {
    expect(isValidEmail('geenemail')).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(isValidEmail('test@')).toBe(false)
  })

  it('rejects email without extension', () => {
    expect(isValidEmail('test@example')).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(isValidEmail('test @example.com')).toBe(false)
  })
})
