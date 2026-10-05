import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  FILTER_MODE: 'aan' as 'uit' | 'meten' | 'aan',
  ALLOWED_IPS: ['1.1.1.1'] as string[],
}))

const blobs = vi.hoisted(() => ({
  lijst: null as unknown,
  leesFout: false,
  vertraging: null as Promise<void> | null,
  schrijfFout: false,
  gelezen: [] as string[],
  setJSON: vi.fn(),
}))

vi.mock('../../netlify/allowed-ips.ts', () => mockConfig)

vi.mock('@netlify/blobs', () => ({
  getStore: (naam: string) => ({
    get: async () => {
      blobs.gelezen.push(naam)
      if (blobs.vertraging) await blobs.vertraging
      if (blobs.leesFout) throw new Error('blob stuk')
      return blobs.lijst
    },
    setJSON: async (sleutel: string, waarde: unknown) => {
      blobs.setJSON(naam, sleutel, waarde)
      if (blobs.schrijfFout) throw new Error('schrijven mislukt')
    },
  }),
}))

import { CLIENT_IP_HEADER } from '../../netlify/client-ip'
import { netwerkKey, vandaag } from '../../netlify/toegang-opslag'

type Handler = typeof import('../../netlify/edge-functions/ip-guard').default
let handler: Handler

function makeContext(ip: string) {
  return {
    ip,
    next: vi.fn((_request?: Request) => Promise.resolve(new Response('ok'))),
    waitUntil: vi.fn((_p: Promise<unknown>) => {}),
  }
}

const BESCHERMD = 'https://example.com/.netlify/functions/sheets'
const OPEN_PADEN = ['/', '/index.html', '/.netlify/functions/session', '/.netlify/functions/order-ids', '/.netlify/functions/time']

describe('ip-guard', () => {
  beforeEach(async () => {
    mockConfig.FILTER_MODE = 'aan'
    mockConfig.ALLOWED_IPS = ['1.1.1.1']
    blobs.lijst = { netwerken: ['2.2.2.2'], bijgewerkt: 1 }
    blobs.leesFout = false
    blobs.vertraging = null
    blobs.schrijfFout = false
    blobs.gelezen = []
    blobs.setJSON.mockClear()
    // Verse module per test: de cache en de "al geregistreerd"-set staan in module-scope
    vi.resetModules()
    handler = (await import('../../netlify/edge-functions/ip-guard')).default
  })

  describe('stand uit', () => {
    beforeEach(() => { mockConfig.FILTER_MODE = 'uit' })

    it('registreert en blokkeert niets', async () => {
      const context = makeContext('9.9.9.9')
      const response = await handler(new Request(BESCHERMD), context)
      expect(response.status).toBe(200)
      expect(context.next).toHaveBeenCalledOnce()
      expect(blobs.setJSON).not.toHaveBeenCalled()
    })
  })

  describe('stand meten', () => {
    beforeEach(() => { mockConfig.FILTER_MODE = 'meten' })

    it('registreert een beschermd pad maar blokkeert niet', async () => {
      const context = makeContext('9.9.9.9')
      const response = await handler(new Request(BESCHERMD), context)
      expect(response.status).toBe(200)
      expect(context.next).toHaveBeenCalledOnce()
      expect(blobs.setJSON).toHaveBeenCalledWith(
        'netwerken',
        netwerkKey(vandaag(), '9.9.9.9'),
        { netwerk: '9.9.9.9', datum: vandaag() },
      )
    })

    it('registreert ook paden met een querystring', async () => {
      await handler(new Request('https://example.com/.netlify/functions/dagoverzicht?datum=2026-10-02'), makeContext('9.9.9.9'))
      expect(blobs.setJSON).toHaveBeenCalledOnce()
    })

    it('registreert een open pad niet', async () => {
      for (const pad of OPEN_PADEN) {
        await handler(new Request(`https://example.com${pad}`), makeContext('9.9.9.9'))
      }
      expect(blobs.setJSON).not.toHaveBeenCalled()
    })

    it('registreert een tweede request van hetzelfde netwerk niet opnieuw', async () => {
      await handler(new Request(BESCHERMD), makeContext('9.9.9.9'))
      await handler(new Request(BESCHERMD), makeContext('9.9.9.9'))
      expect(blobs.setJSON).toHaveBeenCalledOnce()
    })

    it('registreert een ander netwerk wel apart', async () => {
      await handler(new Request(BESCHERMD), makeContext('9.9.9.9'))
      await handler(new Request(BESCHERMD), makeContext('8.8.8.8'))
      expect(blobs.setJSON).toHaveBeenCalledTimes(2)
    })

    it('registreert IPv6 als /64 en schrijft een prefix maar een keer', async () => {
      await handler(new Request(BESCHERMD), makeContext('2a02:0a45:1234:5600:aaaa:bbbb:cccc:dddd'))
      await handler(new Request(BESCHERMD), makeContext('2a02:a45:1234:5600::1'))
      expect(blobs.setJSON).toHaveBeenCalledOnce()
      expect(blobs.setJSON.mock.calls[0][2]).toEqual({ netwerk: '2a02:a45:1234:5600::/64', datum: vandaag() })
    })

    it('registreert een onbekend IP niet', async () => {
      await handler(new Request(BESCHERMD), makeContext(undefined as unknown as string))
      expect(blobs.setJSON).not.toHaveBeenCalled()
    })

    it('gebruikt waitUntil voor het schrijven', async () => {
      const context = makeContext('9.9.9.9')
      await handler(new Request(BESCHERMD), context)
      expect(context.waitUntil).toHaveBeenCalledOnce()
    })

    it('laat de request niet falen als schrijven mislukt, en probeert later opnieuw', async () => {
      blobs.schrijfFout = true
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const context = makeContext('9.9.9.9')
      const response = await handler(new Request(BESCHERMD), context)
      await context.waitUntil.mock.calls[0][0]
      expect(response.status).toBe(200)
      blobs.schrijfFout = false
      await handler(new Request(BESCHERMD), makeContext('9.9.9.9'))
      expect(blobs.setJSON).toHaveBeenCalledTimes(2)
      warn.mockRestore()
    })

    it('werkt ook zonder waitUntil', async () => {
      blobs.schrijfFout = true
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const context = { ip: '9.9.9.9', next: vi.fn(() => Promise.resolve(new Response('ok'))) }
      const response = await handler(new Request(BESCHERMD), context)
      expect(response.status).toBe(200)
      warn.mockRestore()
    })
  })

  describe('stand aan', () => {
    it('blokkeert een beschermd pad van een onbekend netwerk met JSON-403', async () => {
      const context = makeContext('9.9.9.9')
      const response = await handler(new Request(BESCHERMD), context)
      expect(response.status).toBe(403)
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(await response.json()).toEqual({ error: 'geen-toegang', netwerk: '9.9.9.9' })
      expect(context.next).not.toHaveBeenCalled()
    })

    it('noemt bij IPv6 het /64-prefix in de 403', async () => {
      const response = await handler(new Request(BESCHERMD), makeContext('2a02:a45:1234:5600::7'))
      expect(await response.json()).toEqual({ error: 'geen-toegang', netwerk: '2a02:a45:1234:5600::/64' })
    })

    it('registreert ook een geblokkeerd netwerk', async () => {
      await handler(new Request(BESCHERMD), makeContext('9.9.9.9'))
      expect(blobs.setJSON).toHaveBeenCalledOnce()
    })

    it('blokkeert alle drie de beschermde paden', async () => {
      for (const pad of ['sheets', 'forward-webhook', 'dagoverzicht']) {
        const response = await handler(new Request(`https://example.com/.netlify/functions/${pad}?x=1`), makeContext('9.9.9.9'))
        expect(response.status).toBe(403)
      }
    })

    it('laat open paden altijd door', async () => {
      for (const pad of OPEN_PADEN) {
        const context = makeContext('9.9.9.9')
        const response = await handler(new Request(`https://example.com${pad}`), context)
        expect(response.status).toBe(200)
        expect(context.next).toHaveBeenCalledOnce()
      }
    })

    it('geeft toegang aan een netwerk uit de blob-lijst', async () => {
      const context = makeContext('2.2.2.2')
      const response = await handler(new Request(BESCHERMD), context)
      expect(response.status).toBe(200)
      expect(context.next).toHaveBeenCalledOnce()
    })

    it('geeft toegang aan een IPv6-prefix uit de blob-lijst', async () => {
      blobs.lijst = { netwerken: ['2a02:a45:1234:5600::/64'], bijgewerkt: 1 }
      const response = await handler(new Request(BESCHERMD), makeContext('2a02:a45:1234:5600:1:2:3:4'))
      expect(response.status).toBe(200)
    })

    it('geeft toegang aan ALLOWED_IPS, ook als lezen van de blob faalt', async () => {
      blobs.leesFout = true
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const response = await handler(new Request(BESCHERMD), makeContext('1.1.1.1'))
      expect(response.status).toBe(200)
      warn.mockRestore()
    })

    it('valt bij een leesfout terug op ALLOWED_IPS en waarschuwt maar een keer', async () => {
      blobs.leesFout = true
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const r1 = await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
      const r2 = await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
      expect(r1.status).toBe(403)
      expect(r2.status).toBe(403)
      expect(warn).toHaveBeenCalledOnce()
      warn.mockRestore()
    })

    it('blijft bij een latere leesfout de laatst bekende lijst gebruiken', async () => {
      vi.useFakeTimers()
      try {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        expect((await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))).status).toBe(200)
        blobs.leesFout = true
        vi.advanceTimersByTime(61_000)
        expect((await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))).status).toBe(200)
        expect(warn).toHaveBeenCalledOnce()
        // Back-off: binnen 60 s niet opnieuw lezen
        const leesacties = blobs.gelezen.length
        await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
        expect(blobs.gelezen).toHaveLength(leesacties)
        // Na de back-off weer proberen; herstel pakt de nieuwe lijst
        blobs.leesFout = false
        blobs.lijst = { netwerken: ['3.3.3.3'], bijgewerkt: 2 }
        vi.advanceTimersByTime(61_000)
        expect((await handler(new Request(BESCHERMD), makeContext('3.3.3.3'))).status).toBe(200)
        warn.mockRestore()
      } finally {
        vi.useRealTimers()
      }
    })

    it('leest zonder ooit geladen lijst niet bij elke request opnieuw', async () => {
      blobs.leesFout = true
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      for (let i = 0; i < 3; i++) await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
      expect(blobs.gelezen).toHaveLength(1)
      warn.mockRestore()
    })

    it('blokkeert ook varianten van een beschermd pad', async () => {
      for (const pad of ['sheets/', 'SHEETS', '%73heets', 'sheets/x']) {
        const response = await handler(new Request(`https://example.com/.netlify/functions/${pad}`), makeContext('9.9.9.9'))
        expect(response.status).toBe(403)
      }
      const open = await handler(new Request('https://example.com/.netlify/functions/sheetsx'), makeContext('9.9.9.9'))
      expect(open.status).toBe(200)
    })

    it('laat gelijktijdige requests bij een koude start op dezelfde leesactie wachten', async () => {
      let klaar!: () => void
      blobs.vertraging = new Promise<void>((r) => { klaar = r })
      const a = handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
      const b = handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
      klaar()
      expect((await a).status).toBe(200)
      expect((await b).status).toBe(200)
      expect(blobs.gelezen.filter((n) => n === 'toegang')).toHaveLength(1)
    })

    it('gebruikt alleen ALLOWED_IPS als er nog geen lijst is', async () => {
      blobs.lijst = null
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect((await handler(new Request(BESCHERMD), makeContext('1.1.1.1'))).status).toBe(200)
      expect((await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))).status).toBe(403)
      warn.mockRestore()
    })

    it('cachet de lijst', async () => {
      await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
      await handler(new Request(BESCHERMD), makeContext('2.2.2.2'))
      expect(blobs.gelezen.filter((n) => n === 'toegang')).toHaveLength(1)
    })
  })

  it('laat de mail-logos altijd door', async () => {
    const context = makeContext('9.9.9.9')
    await handler(new Request('https://example.com/email/miedema-logo.png'), context)
    expect(context.next).toHaveBeenCalledOnce()
    expect(blobs.setJSON).not.toHaveBeenCalled()
  })

  describe('echt IP doorgeven aan de functies', () => {
    it('zet het IP als header op een verzoek naar een functie, ook met een body', async () => {
      mockConfig.FILTER_MODE = 'uit'
      const context = makeContext('195.222.119.185')
      await handler(new Request('https://example.com/.netlify/functions/forward-webhook', {
        method: 'POST', body: '{"entries":[]}',
      }), context)
      const doorgegeven = context.next.mock.calls[0][0]!
      expect(doorgegeven.headers.get(CLIENT_IP_HEADER)).toBe('195.222.119.185')
      expect(doorgegeven.method).toBe('POST')
      expect(await doorgegeven.text()).toBe('{"entries":[]}')
    })

    it('overschrijft een header die de browser zelf meestuurt', async () => {
      const context = makeContext('1.1.1.1')
      await handler(new Request('https://example.com/.netlify/functions/forward-webhook', {
        method: 'POST', headers: { [CLIENT_IP_HEADER]: '6.6.6.6' }, body: '{}',
      }), context)
      expect(context.next.mock.calls[0][0]!.headers.get(CLIENT_IP_HEADER)).toBe('1.1.1.1')
    })

    it('zet de header ook op een open functie in stand aan', async () => {
      const context = makeContext('9.9.9.9')
      await handler(new Request('https://example.com/.netlify/functions/session'), context)
      expect(context.next.mock.calls[0][0]!.headers.get(CLIENT_IP_HEADER)).toBe('9.9.9.9')
    })

    it('laat andere verzoeken ongemoeid', async () => {
      const context = makeContext('1.1.1.1')
      await handler(new Request('https://example.com/index.html'), context)
      expect(context.next.mock.calls[0][0]).toBeUndefined()
    })
  })
})
