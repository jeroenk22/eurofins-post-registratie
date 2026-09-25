import { describe, it, expect, beforeEach } from 'vitest'
import { addSentToday, dagoverzichtMailto, dayKey, loadSentToday, type SentItem } from '../services/sentToday'

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

describe('dagoverzichtMailto', () => {
  const decode = (link: string) => {
    const [adres, query] = link.replace(/^mailto:/, '').split('?')
    const params = new URLSearchParams(query.replace(/\+/g, '%2B'))
    return { to: decodeURIComponent(adres), cc: params.get('cc'), subject: params.get('subject')!, body: params.get('body')! }
  }

  it('adresseert aan de afzender, met cc, onderwerp en aantal', () => {
    const m = decode(dagoverzichtMailto([item()], 'magazijn@eurofins.nl', 'chef@eurofins.nl', VANDAAG))
    expect(m.to).toBe('magazijn@eurofins.nl')
    expect(m.cc).toBe('chef@eurofins.nl')
    expect(m.subject).toBe('[Postapp] Dagoverzicht 24-09-2026 – 1 zending')
  })

  it('zet per zending tijd, order, ontvanger, route en colli in de mail, oudste eerst', () => {
    const lijst = [item({ id: 'b', orderId: null, sentAt: '2026-09-24T10:05:00.000Z' }, { spoed: true, colli: 1, colliOmschrijvingen: ['Pakket'] }), item()]
    const m = decode(dagoverzichtMailto(lijst, 'a@b.nl', '', VANDAAG))
    const regels = m.body.split('\n')
    expect(regels).toContain('11:22 – Order 1293793 – Jansen (Wageningen) – Route 3 – 2 colli: Doos, Koelbox')
    expect(regels).toContain('12:05 – Geen ordernummer – Jansen (Wageningen) – Route 3 – 1 colli: Pakket – SPOED')
    expect(m.body.indexOf('11:22')).toBeLessThan(m.body.indexOf('12:05'))
    expect(m.cc).toBeNull()
  })

  it('kort een heel lange dag in, zodat de link niet wordt afgekapt', () => {
    const lijst = Array.from({ length: 80 }, (_, i) => item({ id: String(i) }))
    const link = dagoverzichtMailto(lijst, 'a@b.nl', '', VANDAAG)
    expect(link.length).toBeLessThanOrEqual(1900)
    expect(decode(link).body).toMatch(/… en nog \d+ \(zie "Vandaag verzonden" in de app\)\./)
    expect(decode(link).subject).toContain('80 zendingen')
  })
})
