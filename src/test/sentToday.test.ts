import { describe, it, expect, beforeEach } from 'vitest'
import { addSentToday, dayKey, loadSentToday, type SentItem } from '../services/sentToday'

const VANDAAG = new Date('2026-09-24T09:22:31.000Z') // 11:22 in Nederland
const MORGEN = new Date('2026-09-25T06:00:00.000Z')

function item(overrides: Partial<SentItem> = {}, label: Partial<SentItem['label']> = {}): SentItem {
  return {
    id: 'a',
    sentAt: VANDAAG.toISOString(),
    orderId: '1293793',
    label: {
      name: 'Jansen (Wageningen)', adres: 'Dorpsstraat 1', postcode: '6700AA', plaats: 'Wageningen', land: 'Nederland',
      route: 'Route 3', colli: 2, colliOmschrijvingen: ['Doos', 'Koelbox'], spoed: false,
      orderedAt: VANDAAG.toISOString(), orderId: '1293793',
      ...label,
    },
    ...overrides,
  }
}

describe('dayKey', () => {
  it('rekent in Nederlandse tijd: 23:30 UTC is in de zomer al de volgende dag', () => {
    expect(dayKey(new Date('2026-09-24T23:30:00.000Z'))).toBe('2026-09-25')
    expect(dayKey(new Date('2026-09-24T21:30:00.000Z'))).toBe('2026-09-24')
  })
})

describe('verzonden vandaag (localStorage)', () => {
  beforeEach(() => localStorage.clear())

  it('begint leeg', () => {
    expect(loadSentToday(VANDAAG)).toEqual([])
  })

  it('zet een nieuwe zending bovenaan', () => {
    addSentToday(item({ id: 'a' }), VANDAAG)
    const lijst = addSentToday(item({ id: 'b' }), VANDAAG)
    expect(lijst.map(i => i.id)).toEqual(['b', 'a'])
    expect(loadSentToday(VANDAAG).map(i => i.id)).toEqual(['b', 'a'])
  })

  it('is een nieuwe dag weer leeg, en de oude dag verdwijnt bij de eerste nieuwe zending', () => {
    addSentToday(item({ id: 'a' }), VANDAAG)
    expect(loadSentToday(MORGEN)).toEqual([])
    expect(addSentToday(item({ id: 'b' }), MORGEN).map(i => i.id)).toEqual(['b'])
  })

  it('negeert onleesbare opslag', () => {
    localStorage.setItem('verzonden_vandaag', '{kapot')
    expect(loadSentToday(VANDAAG)).toEqual([])
  })
})
