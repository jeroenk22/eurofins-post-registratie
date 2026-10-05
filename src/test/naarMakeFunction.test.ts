import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const blobs = vi.hoisted(() => ({ setJSON: vi.fn() }))
vi.mock('@netlify/blobs', () => ({ getStore: () => ({ setJSON: blobs.setJSON }) }))

import naarMake from '../../netlify/functions/naar-make'

const MAKE_URL = 'https://hook.eu2.make.com/geheim-token-123'
const CODE = 'abcdEFGH1234_-xy'
const payload = (over: Record<string, unknown> = {}) => JSON.stringify({ submission_id: CODE, ...over })

const post = (body: string, method = 'POST') =>
  new Request('https://app.example/.netlify/functions/naar-make', {
    method,
    body: method === 'GET' ? undefined : body,
  })

describe('naar-make', () => {
  beforeEach(() => {
    blobs.setJSON.mockReset().mockResolvedValue(undefined)
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
    const res = await naarMake(post(payload()))
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

  it.each(['{}', '{"submission_id":"kort"}', '{"submission_id":"abcdEFGH1234_-x!"}', '{"submission_id":5}'])(
    'geeft 400 zonder geldige submission_id: %s',
    async (body) => {
      const res = await naarMake(post(body))
      expect(res.status).toBe(400)
      expect(fetch).not.toHaveBeenCalled()
      expect(blobs.setJSON).not.toHaveBeenCalled()
    },
  )

  it("slaat labels en foto's per entry op en stuurt door zonder labels", async () => {
    const labels = [{ name: 'Jansen', adres: 'A 1' }]
    const rest = {
      submission_id: CODE,
      entries: [
        { entry_number: 1, recipient: 'Jansen', shelf: 'Schap 3', photos: [{ filename: 'a.jpg', base64: 'data:image/jpeg;base64,AA' }] },
        { entry_number: 2, recipient: 'Zonder', shelf: 'Schap 4', photos: [] },
        { entry_number: 3, recipient: 'Piet', shelf: 'Overig: x', photos: [{ filename: 'b.jpg', base64: 'data:image/jpeg;base64,BB' }] },
      ],
    }
    const res = await naarMake(post(JSON.stringify({ ...rest, labels })))
    expect(res.status).toBe(200)

    const opgeslagen = Object.fromEntries(blobs.setJSON.mock.calls.map(([k, v]) => [k, v]))
    expect(Object.keys(opgeslagen)).toEqual([`${CODE}/labels`, `${CODE}/fotos/1`, `${CODE}/fotos/3`])
    expect(opgeslagen[`${CODE}/labels`]).toMatchObject({ labels })
    expect(typeof opgeslagen[`${CODE}/labels`].createdAt).toBe('number')
    expect(opgeslagen[`${CODE}/fotos/1`]).toMatchObject({
      naam: 'Jansen', schap: 'Schap 3', fotos: [{ naam: 'a.jpg', data: 'data:image/jpeg;base64,AA' }],
    })
    expect(opgeslagen[`${CODE}/fotos/3`]).toMatchObject({ naam: 'Piet', schap: 'Overig: x' })

    const doorgestuurd = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(doorgestuurd).toEqual(rest)
    expect(doorgestuurd).not.toHaveProperty('labels')
  })

  it('werkt zonder labels (oude client): geen labels opgeslagen, wel doorgestuurd', async () => {
    const body = payload({ entries: [] })
    expect((await naarMake(post(body))).status).toBe(200)
    expect(blobs.setJSON).not.toHaveBeenCalled()
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body).toBe(body)
  })

  it('slaat ongeldige labels niet op maar gaat wel door', async () => {
    expect((await naarMake(post(payload({ labels: [{ adres: 'geen naam' }] })))).status).toBe(200)
    expect(blobs.setJSON).not.toHaveBeenCalled()
  })

  it('geeft 500 en stuurt niets naar Make als opslaan mislukt', async () => {
    blobs.setJSON.mockRejectedValue(new Error('blobs stuk'))
    const res = await naarMake(post(payload({ labels: [{ name: 'A' }] })))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, error: 'opslaan mislukt' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stuurt de body zonder labels byte-identiek door en geeft 200', async () => {
    const body = `{ "submission_id" : "${CODE}",  "naam":"Müller" }`
    const res = await naarMake(post(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(MAKE_URL)
    expect((init as RequestInit).body).toBe(body)
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('stuurt x-make-apikey mee als MAKE_WEBHOOK_KEY is gezet, anders niet', async () => {
    await naarMake(post(payload()))
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' })
    vi.stubEnv('MAKE_WEBHOOK_KEY', 'geheim-123')
    await naarMake(post(payload()))
    expect(((vi.mocked(fetch).mock.calls[1][1] as RequestInit).headers as Record<string, string>)['x-make-apikey']).toBe('geheim-123')
    vi.stubEnv('MAKE_WEBHOOK_KEY', '')
    await naarMake(post(payload()))
    expect(((vi.mocked(fetch).mock.calls[2][1] as RequestInit).headers as Record<string, string>)['x-make-apikey']).toBeUndefined()
  })

  it('geeft 502 met de Make-status bij een Make-fout, zonder Make-antwoord', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`fout bij ${MAKE_URL}`, { status: 500 })))
    const res = await naarMake(post(payload()))
    expect(res.status).toBe(502)
    const tekst = await res.text()
    expect(JSON.parse(tekst)).toEqual({ ok: false, status: 500 })
    expect(tekst).not.toContain('make.com')
  })

  it('geeft 502 bij een netwerkfout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`kan ${MAKE_URL} niet bereiken`)))
    const res = await naarMake(post(payload()))
    expect(res.status).toBe(502)
    const tekst = await res.text()
    expect(JSON.parse(tekst)).toEqual({ ok: false })
    expect(tekst).not.toContain('make.com')
  })

  it('logt de Make-URL en persoonsgegevens nooit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`kan ${MAKE_URL} niet bereiken`)))
    await naarMake(post(payload({ sender_email: 'jan@example.com' })))
    const gelogd = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(gelogd).not.toContain('make.com')
    expect(gelogd).not.toContain('jan@example.com')
    expect(gelogd).toContain(CODE)
  })
})
