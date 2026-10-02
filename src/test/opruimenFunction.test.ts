import { describe, it, expect, vi, beforeEach } from 'vitest'

const blobs = vi.hoisted(() => ({ getStore: vi.fn() }))
vi.mock('@netlify/blobs', () => ({ getStore: blobs.getStore }))

import {
  opruimen, SESSIE_BEWAARTERMIJN_MS, ORDER_ID_BEWAARTERMIJN_MS, type OpruimStores,
} from '../../netlify/functions/opruimen'

const NOW = Date.UTC(2026, 9, 2, 12)

/** Nep-store met pagina's; `data` is de ruwe tekst per sleutel. */
function maakStore(paginas: string[][], data: Record<string, string>, faalBij: string[] = []) {
  const deleted: string[] = []
  return {
    deleted,
    store: {
      list: () => (async function* () {
        for (const keys of paginas) yield { blobs: keys.map((key) => ({ key })) }
      })(),
      get: vi.fn(async (key: string) => {
        if (faalBij.includes(key)) throw new Error('storing')
        return data[key] ?? null
      }),
      delete: vi.fn(async (key: string) => { deleted.push(key) }),
    },
  }
}

const json = (o: object) => JSON.stringify(o)
const leeg = () => maakStore([], {}).store

describe('opruimen', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('verwijdert sessies precies voorbij 2 dagen en bewaart de rest', async () => {
    const s = maakStore([['vers', 'grens', 'oud']], {
      vers: json({ updatedAt: NOW - SESSIE_BEWAARTERMIJN_MS + 1 }),
      grens: json({ updatedAt: NOW - SESSIE_BEWAARTERMIJN_MS }),
      oud: json({ updatedAt: NOW - SESSIE_BEWAARTERMIJN_MS - 1 }),
    })
    const res = await opruimen(NOW, { sessies: s.store, orderIds: leeg() } as OpruimStores)
    expect(s.deleted).toEqual(['oud'])
    expect(res).toEqual({ sessies: 1, orderIds: 0 })
  })

  it('valt voor een sessie terug op createdAt als updatedAt 0 is of ontbreekt', async () => {
    const s = maakStore([['a', 'b', 'c', 'd']], {
      a: json({ updatedAt: 0, createdAt: NOW - SESSIE_BEWAARTERMIJN_MS - 1 }),
      b: json({ createdAt: NOW - SESSIE_BEWAARTERMIJN_MS - 1 }),
      c: json({ updatedAt: 0, createdAt: NOW - 1000 }),
      d: json({ createdAt: NOW - 1000 }),
    })
    await opruimen(NOW, { sessies: s.store, orderIds: leeg() })
    expect(s.deleted).toEqual(['a', 'b'])
  })

  it('verwijdert order-ID\'s voorbij 30 dagen en bewaart de rest', async () => {
    const o = maakStore([['vers', 'grens', 'oud']], {
      vers: json({ orderIds: ['1'], createdAt: NOW - ORDER_ID_BEWAARTERMIJN_MS + 1 }),
      grens: json({ orderIds: ['1'], createdAt: NOW - ORDER_ID_BEWAARTERMIJN_MS }),
      oud: json({ orderIds: ['1'], createdAt: NOW - ORDER_ID_BEWAARTERMIJN_MS - 1 }),
    })
    const res = await opruimen(NOW, { sessies: leeg(), orderIds: o.store })
    expect(o.deleted).toEqual(['oud'])
    expect(res.orderIds).toBe(1)
  })

  it('verwijdert entries zonder tijdstip of met kapotte JSON', async () => {
    const s = maakStore([['geen', 'kapot', 'nul', 'lijst']], {
      geen: json({ entries: [] }), kapot: '{niet-json', nul: 'null', lijst: '[]',
    })
    const o = maakStore([['geen', 'kapot']], { geen: json({ orderIds: [] }), kapot: '%%%' })
    const res = await opruimen(NOW, { sessies: s.store, orderIds: o.store })
    expect(s.deleted).toEqual(['geen', 'kapot', 'nul', 'lijst'])
    expect(o.deleted).toEqual(['geen', 'kapot'])
    expect(res).toEqual({ sessies: 4, orderIds: 2 })
  })

  it('loopt alle pagina\'s door', async () => {
    const oud = json({ updatedAt: NOW - SESSIE_BEWAARTERMIJN_MS - 1 })
    const s = maakStore([['p1a', 'p1b'], ['p2a'], ['p3a']], { p1a: oud, p1b: oud, p2a: oud, p3a: oud })
    const res = await opruimen(NOW, { sessies: s.store, orderIds: leeg() })
    expect(s.deleted).toEqual(['p1a', 'p1b', 'p2a', 'p3a'])
    expect(res.sessies).toBe(4)
  })

  it('een fout bij één item stopt de rest niet', async () => {
    const oud = json({ updatedAt: NOW - SESSIE_BEWAARTERMIJN_MS - 1 })
    const s = maakStore([['a', 'stuk', 'b']], { a: oud, stuk: oud, b: oud }, ['stuk'])
    const res = await opruimen(NOW, { sessies: s.store, orderIds: leeg() })
    expect(s.deleted).toEqual(['a', 'b'])
    expect(res.sessies).toBe(2)
  })

  it('een mislukte delete stopt de rest niet en telt niet mee', async () => {
    const oud = json({ updatedAt: NOW - SESSIE_BEWAARTERMIJN_MS - 1 })
    const s = maakStore([['a', 'b']], { a: oud, b: oud })
    s.store.delete.mockImplementationOnce(async () => { throw new Error('nee') })
    const res = await opruimen(NOW, { sessies: s.store, orderIds: leeg() })
    expect(s.deleted).toEqual(['b'])
    expect(res.sessies).toBe(1)
  })

  it('een falende list van de ene store stopt de andere niet', async () => {
    const kapot = { list: () => { throw new Error('list stuk') }, get: vi.fn(), delete: vi.fn() }
    const o = maakStore([['oud']], { oud: json({ createdAt: 1 }) })
    const res = await opruimen(NOW, { sessies: kapot as unknown as OpruimStores['sessies'], orderIds: o.store })
    expect(o.deleted).toEqual(['oud'])
    expect(res).toEqual({ sessies: 0, orderIds: 1 })
  })

  it('logt één regel met aantallen en geen inhoud', async () => {
    const s = maakStore([['a']], { a: json({ updatedAt: 1, entries: [{ name: 'Geheime Naam' }] }) })
    await opruimen(NOW, { sessies: s.store, orderIds: leeg() })
    expect(console.log).toHaveBeenCalledTimes(1)
    const regel = String(vi.mocked(console.log).mock.calls[0][0])
    expect(regel).not.toContain('Geheime')
    expect(regel).toContain('1 sessies')
  })
})
