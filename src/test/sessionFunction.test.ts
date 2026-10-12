import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory Netlify Blobs: inhoud en metadata per sleutel
const blobs = new Map<string, { data: string; metadata: Record<string, unknown> }>()
const store = {
  get: vi.fn(async (key: string) => blobs.get(key)?.data ?? null),
  set: vi.fn(async (key: string, data: string, opts?: { metadata?: Record<string, unknown> }) => {
    blobs.set(key, { data, metadata: opts?.metadata ?? {} })
  }),
  getMetadata: vi.fn(async (key: string) => {
    const b = blobs.get(key)
    return b ? { metadata: b.metadata } : null
  }),
}
vi.mock('@netlify/blobs', () => ({ getStore: () => store }))

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
    blobs.set(ID, { data: JSON.stringify({ entries: [], photos: {}, createdAt: 1, updatedAt: 5 }), metadata: {} })
    const data = await (await session(new Request(url('&since=10')))).json()
    expect(data.updatedAt).toBe(5)
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
