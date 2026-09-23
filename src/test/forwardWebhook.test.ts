import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const blobs = vi.hoisted(() => ({ setJSON: vi.fn(), storeName: '' }))
vi.mock('@netlify/blobs', () => ({
  getStore: (name: string) => { blobs.storeName = name; return { setJSON: blobs.setJSON } },
}))

import type { Context } from '@netlify/functions'
import handler from '../../netlify/functions/forward-webhook'

describe('forward-webhook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    vi.stubEnv('NETLIFY_WEBHOOK_URL', 'https://example.com/.netlify/functions/create-order')
    vi.stubEnv('NETLIFY_WEBHOOK_SECRET', 'test-secret-32bytes-padding-here')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('geeft 405 terug bij een niet-POST request', async () => {
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', { method: 'GET' })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('geeft 500 terug als env vars niet ingesteld zijn', async () => {
    vi.stubEnv('NETLIFY_WEBHOOK_URL', '')
    vi.stubEnv('NETLIFY_WEBHOOK_SECRET', '')
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    })
    const res = await handler(req)
    expect(res.status).toBe(500)
  })

  it('stuurt de body door naar de target URL, aangevuld met het IP van de gebruiker', async () => {
    const payload = { submitted_at: '2026-01-01T00:00:00.000Z', entries: [] }
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await handler(req, { ip: '195.222.119.185' } as Context)
    const [targetUrl, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(targetUrl).toBe('https://example.com/.netlify/functions/create-order')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ ...payload, client_ip: '195.222.119.185' }))
  })

  it('overschrijft een client_ip dat de browser zelf meestuurt', async () => {
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ entries: [], client_ip: '1.2.3.4' }),
    })
    await handler(req, { ip: '195.222.119.185' } as Context)
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string).client_ip).toBe('195.222.119.185')

    await handler(new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ entries: [], client_ip: '1.2.3.4' }),
    }))
    expect(JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string).client_ip).toBeNull()
  })

  it('ondertekent de body mét het IP, zodat create-order het kan vertrouwen', async () => {
    const { createHmac } = await import('node:crypto')
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ entries: [] }),
    })
    await handler(req, { ip: '195.222.119.185' } as Context)
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    const expected = createHmac('sha256', 'test-secret-32bytes-padding-here')
      .update(`${headers['X-Timestamp']}.${init.body as string}`)
      .digest('hex')
    expect(headers['X-Signature']).toBe(expected)
  })

  it('stuurt een body die geen JSON-object is ongewijzigd door', async () => {
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: 'geen json',
    })
    await handler(req, { ip: '195.222.119.185' } as Context)
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body).toBe('geen json')
  })

  it('stuurt X-Timestamp en X-Signature headers mee', async () => {
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    })
    await handler(req)
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['X-Timestamp']).toMatch(/^\d+$/)
    expect(headers['X-Signature']).toMatch(/^[0-9a-f]{64}$/)
  })

  it('X-Timestamp is niet ouder dan 5 seconden', async () => {
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    })
    await handler(req)
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>
    const ts = Number(headers['X-Timestamp'])
    expect(ts).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000) - 5)
  })

  it('geeft 200 terug als de target ok antwoordt', async () => {
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
  })

  it('geeft 502 terug als de target een fout antwoordt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    })
    const res = await handler(req)
    expect(res.status).toBe(502)
  })

  describe("Mendrix order-ID's", () => {
    const post = () => handler(new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify({ test: 1 }),
    }))
    const createOrderAntwoord = (body: unknown) =>
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }))

    it('geeft per entry het order-ID terug, null voor een mislukte entry', async () => {
      createOrderAntwoord({ resultaten: [
        { succes: true, orderId: '1234567', resultaat: 'srInserted' },
        { succes: false, fout: 'SOAP fout: timeout' },
      ] })
      const body = await (await post()).json()
      expect(body.orderIds).toEqual(['1234567', null])
    })

    it("stuurt alleen de ID's terug, niet de rest van het create-order antwoord", async () => {
      createOrderAntwoord({ resultaten: [{ succes: true, orderId: '1', clResponse: '<geheim/>', fotos: [] }] })
      const body = await (await post()).json()
      expect(Object.keys(body).sort()).toEqual(['ok', 'orderIds', 'status'])
      expect(JSON.stringify(body)).not.toContain('geheim')
    })

    it("accepteert alleen numerieke order-ID's", async () => {
      createOrderAntwoord({ resultaten: [
        { succes: true, orderId: 42 },
        { succes: true, orderId: '<script>' },
        { succes: true, orderId: '' },
      ] })
      const body = await (await post()).json()
      expect(body.orderIds).toEqual(['42', null, null])
    })

    it('geeft een lege lijst bij een onverwacht of ongeldig antwoord', async () => {
      createOrderAntwoord({ iets: 'anders' })
      expect((await (await post()).json()).orderIds).toEqual([])

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('x')) }))
      const res = await post()
      expect(res.status).toBe(200)
      expect((await res.json()).orderIds).toEqual([])
    })

    it('geeft een lege lijst als create-order een fout geeft', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ resultaten: [{ succes: true, orderId: '1' }] }) }))
      const res = await post()
      expect(res.status).toBe(502)
      expect((await res.json()).orderIds).toEqual([])
    })
  })

  describe("order-ID's bewaren voor de print-link uit de mail", () => {
    const code = 'abcdEFGH1234_-xy'
    const post = (payload: unknown) => handler(new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
    }))
    const createOrderAntwoord = (resultaten: unknown[]) =>
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ resultaten }) }))

    beforeEach(() => { blobs.setJSON.mockReset().mockResolvedValue(undefined) })

    it('bewaart de order-ID\'s onder de aanmeldingscode', async () => {
      createOrderAntwoord([{ succes: true, orderId: '1234567' }, { succes: false }])
      await post({ submission_id: code, entries: [] })
      expect(blobs.storeName).toBe('order-ids')
      expect(blobs.setJSON).toHaveBeenCalledWith(code, { orderIds: ['1234567', null], createdAt: expect.any(Number) })
    })

    it('bewaart niets zonder (geldige) aanmeldingscode', async () => {
      createOrderAntwoord([{ succes: true, orderId: '1234567' }])
      await post({ entries: [] })
      await post({ submission_id: '../../geheim', entries: [] })
      expect(blobs.setJSON).not.toHaveBeenCalled()
    })

    it('bewaart niets als er geen enkele order is aangemaakt', async () => {
      createOrderAntwoord([{ succes: false, fout: 'SOAP fout' }])
      await post({ submission_id: code, entries: [] })
      expect(blobs.setJSON).not.toHaveBeenCalled()
    })

    it('geeft de ID\'s gewoon aan de app als het bewaren mislukt', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      blobs.setJSON.mockImplementation(async () => { throw new Error('blobs down') })
      createOrderAntwoord([{ succes: true, orderId: '1234567' }])
      const res = await post({ submission_id: code, entries: [] })
      expect(res.status).toBe(200)
      expect((await res.json()).orderIds).toEqual(['1234567'])
    })
  })
})
