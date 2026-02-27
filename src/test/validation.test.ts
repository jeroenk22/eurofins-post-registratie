import { describe, it, expect } from 'vitest'
import type { PostEntry } from '../types'

// Extracted validate logic — mirrors App.tsx
function validate(
  entries: PostEntry[],
  senderName: string,
): string | null {
  if (entries.some(e => !e.shelf))       return 'Selecteer bij elke zending een schap nummer.'
  if (entries.some(e => !e.name.trim())) return 'Vul bij elke zending een naam of bedrijf in.'
  if (!senderName.trim())                return 'Vul je naam in (onderaan het formulier).'
  return null
}

const validEntry = (): PostEntry => ({
  id: '1', shelf: 3, name: 'Acme', colli: 1, spoed: false, photos: [],
})

describe('form validation', () => {
  it('passes when all fields are filled', () => {
    expect(validate([validEntry()], 'Sophie')).toBeNull()
  })

  it('fails when an entry has no shelf selected', () => {
    const entry = { ...validEntry(), shelf: null }
    expect(validate([entry], 'Sophie')).toMatch(/schap nummer/)
  })

  it('fails when an entry has an empty name', () => {
    const entry = { ...validEntry(), name: '' }
    expect(validate([entry], 'Sophie')).toMatch(/naam of bedrijf/)
  })

  it('fails when entry name is only whitespace', () => {
    const entry = { ...validEntry(), name: '   ' }
    expect(validate([entry], 'Sophie')).toMatch(/naam of bedrijf/)
  })

  it('fails when sender name is empty', () => {
    expect(validate([validEntry()], '')).toMatch(/Vul je naam in/)
  })

  it('fails when sender name is only whitespace', () => {
    expect(validate([validEntry()], '   ')).toMatch(/Vul je naam in/)
  })

  it('checks all entries — fails on second entry missing shelf', () => {
    const entries = [validEntry(), { ...validEntry(), id: '2', shelf: null }]
    expect(validate(entries, 'Sophie')).toMatch(/schap nummer/)
  })

  it('shelf validation takes priority over name validation', () => {
    const entry = { ...validEntry(), shelf: null, name: '' }
    expect(validate([entry], 'Sophie')).toMatch(/schap nummer/)
  })
})
