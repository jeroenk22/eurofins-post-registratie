import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import naarMake from '../../netlify/functions/naar-make'

const MAKE_URL = 'https://hook.eu2.make.com/geheim-token-123'

const post = (body: string, method = 'POST') =>
  new Request('https://app.example/.netlify/functions/naar-make', {
    method,
    body: method === 'GET' ? undefined : body,
  })

describe('naar-make', () => {
  beforeEach(() => {
    vi.stubEnv('MAKE_WEBHOOK_URL', MAKE_URL)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Accepted', { status: 200 })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('geeft 405 bij een andere methode dan POST', async () => {
    const res = await naarMake(post('', 'GET'))
    expect(res.status).toBe(405)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('geeft 503 zonder MAKE_WEBHOOK_URL', async () => {
    vi.stubEnv('MAKE_WEBHOOK_URL', '')
    const res = await naarMake(post('{"a":1}'))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Make-koppeling niet ingesteld' })
    expect(console.error).toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['geen json', '[1,2]', 'null', '"tekst"'])('geeft 400 bij ongeldige body %s', async (body) => {
    const res = await naarMake(post(body))
    expect(res.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stuurt de body byte-identiek door en geeft 200', async () => {
    const body = '{ "submission_id" : "abcdefghijklmnop",  "naam":"Müller" }'
    const res = await naarMake(post(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(MAKE_URL)
    expect((init as RequestInit).body).toBe(body)
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('geeft 502 met de Make-status bij een Make-fout, zonder Make-antwoord', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`fout bij ${MAKE_URL}`, { status: 500 })))
    const res = await naarMake(post('{"a":1}'))
    expect(res.status).toBe(502)
    const tekst = await res.text()
    expect(JSON.parse(tekst)).toEqual({ ok: false, status: 500 })
    expect(tekst).not.toContain('make.com')
  })

  it('geeft 502 bij een netwerkfout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`kan ${MAKE_URL} niet bereiken`)))
    const res = await naarMake(post('{"a":1}'))
    expect(res.status).toBe(502)
    const tekst = await res.text()
    expect(JSON.parse(tekst)).toEqual({ ok: false })
    expect(tekst).not.toContain('make.com')
  })

  it('logt de Make-URL en persoonsgegevens nooit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`kan ${MAKE_URL} niet bereiken`)))
    await naarMake(post('{"submission_id":"abcdefghijklmnop","sender_email":"jan@example.com"}'))
    const gelogd = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(gelogd).not.toContain('make.com')
    expect(gelogd).not.toContain('jan@example.com')
    expect(gelogd).toContain('abcdefghijklmnop')
  })
})
