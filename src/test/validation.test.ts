import { describe, it, expect } from 'vitest'
import type { PostEntry } from '../types'
import { validateForm, isValidEmail, isValidPhone } from '../validation'

const mockPhoto = { id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }

const validEntry = (): PostEntry => ({
  id: '1', shelf: 3, shelfDescription: '', name: 'Acme', adres: '', postcode: '', plaats: '', land: '', colli: 1, colliOmschrijvingen: ['Test omschrijving'], spoed: false, photos: [mockPhoto],
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

  it('passes when cc email is empty (optional)', () => {
    expect(validateForm([validEntry()], 'Sophie', 'sophie@example.com', '')).toBeNull()
  })

  it('passes when cc email is valid', () => {
    expect(validateForm([validEntry()], 'Sophie', 'sophie@example.com', 'cc@example.com')).toBeNull()
  })

  it('fails when cc email is filled but invalid', () => {
    expect(validateForm([validEntry()], 'Sophie', '', 'geen-email')).toMatch(/CC e-mailadres/)
  })

  it('fails when cc email has no domain', () => {
    expect(validateForm([validEntry()], 'Sophie', '', 'cc@')).toMatch(/CC e-mailadres/)
  })

  it('trims cc email before validating', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '  cc@example.com  ')).toBeNull()
  })

  it('sender email error takes priority over cc email error', () => {
    expect(validateForm([validEntry()], 'Sophie', 'geen-email', 'ook-geen-email')).toMatch(/^Vul een geldig e-mailadres/)
  })
})

describe('validateForm — colli omschrijvingen verplicht', () => {
  const mestklantEntry = (): PostEntry => ({
    ...validEntry(),
    recipientType: 'Mestklanten',
    colliOmschrijvingen: ['Eijkelkamp deksels'],
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
    const entry = { ...mestklantEntry(), colli: 2, colliOmschrijvingen: ['Eijkelkamp deksels', ''] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('geeft geen fout als mestklant colli=2 heeft en beide omschrijvingen ingevuld', () => {
    const entry = { ...mestklantEntry(), colli: 2, colliOmschrijvingen: ['Eijkelkamp deksels', 'D-Tech (KLEINE DOOS)'] }
    expect(validateForm([entry], 'Sophie', '')).toBeNull()
  })

  it('geeft fout voor niet-mestklant met lege omschrijving', () => {
    const entry = { ...validEntry(), colliOmschrijvingen: [] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('geeft fout voor AP06-entry met lege omschrijving', () => {
    const entry = { ...validEntry(), recipientType: 'AP06' as const, colliOmschrijvingen: [] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('geeft fout voor Monsternemer-entry met lege omschrijving', () => {
    const entry = { ...validEntry(), recipientType: 'Monsternemers' as const, colliOmschrijvingen: [] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('mestklant omschrijving-fout gaat vóór foto-fout', () => {
    const entry = { ...mestklantEntry(), colliOmschrijvingen: [], photos: [] }
    expect(validateForm([entry], 'Sophie', '')).toMatch(/omschrijving/)
  })

  it('alle label-waarden zijn geldige omschrijvingen', () => {
    const labels = [
      'Eijkelkamp deksels',
      'D-Tech (KLEINE DOOS)',
      'D-Tech (GROTE DOOS)',
      'Vaste mestzakken (50st)',
      'Vaste mestzakken (500st)',
    ]
    for (const label of labels) {
      const entry = { ...mestklantEntry(), colliOmschrijvingen: [label] }
      expect(validateForm([entry], 'Sophie', ''), `Label "${label}" moet geldig zijn`).toBeNull()
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

describe('validateForm — telefoonnummer validatie', () => {
  it('passes when phone is empty (optional)', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '', '')).toBeNull()
  })

  it('passes when phone contains only digits', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '', '0612345678')).toBeNull()
  })

  it('passes when phone contains digits and spaces', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '', '06 12 34 56 78')).toBeNull()
  })

  it('passes when phone contains dashes', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '', '06-12345678')).toBeNull()
  })

  it('passes when phone starts with +', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '', '+31612345678')).toBeNull()
  })

  it('fails when phone contains letters', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '', '5865987fdf')).toMatch(/geldig telefoonnummer/)
  })

  it('fails when phone is only letters', () => {
    expect(validateForm([validEntry()], 'Sophie', '', '', 'abcdef')).toMatch(/geldig telefoonnummer/)
  })
})

describe('isValidPhone', () => {
  it('accepts digits only', () => expect(isValidPhone('0612345678')).toBe(true))
  it('accepts digits with spaces', () => expect(isValidPhone('06 12 34 56 78')).toBe(true))
  it('accepts digits with dashes', () => expect(isValidPhone('06-12-34-56-78')).toBe(true))
  it('accepts leading +', () => expect(isValidPhone('+31612345678')).toBe(true))
  it('rejects letters mixed with digits', () => expect(isValidPhone('5865987fdf')).toBe(false))
  it('rejects letters only', () => expect(isValidPhone('abcdef')).toBe(false))
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
