import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory Netlify Blobs: inhoud, metadata en ETag per sleutel, met voorwaardelijk schrijven
const blobs = new Map<string, { data: string; metadata: Record<string, unknown>; etag: string }>()
let versie = 0
type SetOpts = { metadata?: Record<string, unknown>; onlyIfMatch?: string; onlyIfNew?: boolean }
const store = {
  get: vi.fn(async (key: string) => blobs.get(key)?.data ?? null),
  getWithMetadata: vi.fn(async (key: string) => {
    const b = blobs.get(key)
    return b ? { data: b.data, metadata: b.metadata, etag: b.etag } : null
  }),
  set: vi.fn(async (key: string, data: string, opts: SetOpts = {}) => {
    const huidig = blobs.get(key)
    if (opts.onlyIfNew && huidig) return { modified: false }
    if (opts.onlyIfMatch && huidig?.etag !== opts.onlyIfMatch) return { modified: false }
    const etag = `"v${++versie}"`
    blobs.set(key, { data, metadata: opts.metadata ?? {}, etag })
    return { modified: true, etag }
  }),
  getMetadata: vi.fn(async (key: string) => {
    const b = blobs.get(key)
    return b ? { metadata: b.metadata, etag: b.etag } : null
  }),
}
const getStore = vi.fn((..._args: unknown[]) => store)
vi.mock('@netlify/blobs', () => ({ getStore: (...args: unknown[]) => getStore(...args) }))

import session from '../../netlify/functions/session'

const ID = 'AAAAAAAAAAAAAAAAAAAAAA'
const url = (query = '') => `https://x.test/.netlify/functions/session?id=${ID}${query}`
const post = (body: unknown) =>
  session(new Request(url(), { method: 'POST', body: JSON.stringify({ id: ID, ...(body as object) }) }))

describe('session-functie: GET met since', () => {
  beforeEach(() => {
    blobs.clear()
    vi.clearAllMocks()
  })

  it('stuurt alleen "ongewijzigd" als er sinds since niets veranderd is, zonder de sessie te lezen', async () => {
    await post({ entryId: 'e1', photos: [{ id: 'p1', name: 'a.jpg', data: 'data:image/jpeg;base64,abc' }] })
    const { updatedAt } = await (await session(new Request(url()))).json()
    store.get.mockClear()

    const res = await session(new Request(url(`&since=${updatedAt}`)))
    expect(await res.json()).toEqual({ ongewijzigd: true, updatedAt })
    expect(store.get).not.toHaveBeenCalled()
  })

  it('stuurt alles als er iets nieuws is', async () => {
    await post({ entryId: 'e1', photos: [{ id: 'p1', name: 'a.jpg', data: 'x' }] })
    const res = await session(new Request(url('&since=1')))
    const data = await res.json()
    expect(data.ongewijzigd).toBeUndefined()
    expect(data.photos.e1).toHaveLength(1)
  })

  it('stuurt alles voor sessies zonder metadata (van vóór deze versie)', async () => {
    blobs.set(ID, { data: JSON.stringify({ entries: [], photos: {}, createdAt: 1, updatedAt: 5 }), metadata: {}, etag: '"oud"' })
    const data = await (await session(new Request(url('&since=10')))).json()
    expect(data.updatedAt).toBe(5)
  })

  it('leest altijd de nieuwste versie (strong consistency), niet een gecachte', async () => {
    await session(new Request(url()))
    expect(getStore).toHaveBeenCalledWith('mobile-sessions', { consistency: 'strong' })
  })

  it('geeft 404 voor een onbekende sessie, ook met since', async () => {
    expect((await session(new Request(url('&since=10')))).status).toBe(404)
  })

  it('bewaart updatedAt ook als metadata bij het opslaan van zendingen', async () => {
    await post({ entries: [] })
    const opgeslagen = blobs.get(ID)!
    expect(opgeslagen.metadata.updatedAt).toBe(JSON.parse(opgeslagen.data).updatedAt)
  })
})

describe('session-functie: gelijktijdige uploads', () => {
  beforeEach(() => {
    blobs.clear()
    vi.clearAllMocks()
  })

  it("verliest geen foto's als de telefoon meerdere zendingen tegelijk uploadt", async () => {
    await post({ entries: [] })
    const foto = (e: string) => [{ id: `p-${e}`, name: 'a.jpg', data: 'x' }]
    const antwoorden = await Promise.all(['e1', 'e2', 'e3'].map(e => post({ entryId: e, photos: foto(e) })))

    expect(antwoorden.map(r => r.status)).toEqual([200, 200, 200])
    const { photos } = JSON.parse(blobs.get(ID)!.data)
    expect(Object.keys(photos).sort()).toEqual(['e1', 'e2', 'e3'])
  })

  it("houdt foto's als de desktop tegelijk de zendingen bijwerkt", async () => {
    await post({ entries: [] })
    await Promise.all([
      post({ entryId: 'e1', photos: [{ id: 'p1', name: 'a.jpg', data: 'x' }] }),
      post({ entries: [{ id: 'e1', name: 'Kees', colli: 1, colliOmschrijvingen: [], desktopPhotoCount: 0 }] }),
    ])
    const sessie = JSON.parse(blobs.get(ID)!.data)
    expect(sessie.photos.e1).toHaveLength(1)
    expect(sessie.entries).toHaveLength(1)
  })

  it('geeft na herhaald mislukken een fout in plaats van stil te overschrijven', async () => {
    await post({ entries: [] })
    store.set.mockClear()
    for (let i = 0; i < 5; i++) store.set.mockResolvedValueOnce({ modified: false })
    const res = await post({ entryId: 'e1', photos: [] })
    expect(res.status).toBe(500)
    expect(store.set).toHaveBeenCalledTimes(5)
  })
})
