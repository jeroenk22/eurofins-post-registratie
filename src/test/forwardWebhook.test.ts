import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('stuurt de body ongewijzigd door naar de target URL', async () => {
    const payload = { submitted_at: '2026-01-01T00:00:00.000Z', entries: [] }
    const req = new Request('https://site.com/.netlify/functions/forward-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await handler(req)
    const [targetUrl, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(targetUrl).toBe('https://example.com/.netlify/functions/create-order')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify(payload))
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
})
