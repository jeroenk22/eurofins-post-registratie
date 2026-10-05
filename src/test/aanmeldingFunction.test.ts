import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AANMELDING_BEWAARTERMIJN_MS } from '../../netlify/aanmelding-opslag'

const blobs = vi.hoisted(() => ({ data: {} as Record<string, unknown>, orderFout: false }))
vi.mock('@netlify/blobs', () => ({
  getStore: (opts: string | { name: string }) => {
    const name = typeof opts === 'string' ? opts : opts.name
    return {
      get: vi.fn(async (key: string) => {
        if (name === 'order-ids' && blobs.orderFout) throw new Error('stuk')
        return blobs.data[`${name}:${key}`] ?? null
      }),
      list: vi.fn(async ({ prefix }: { prefix: string }) => ({
        blobs: Object.keys(blobs.data)
          .filter(k => k.startsWith(`${name}:${prefix}`))
          .map(k => ({ key: k.slice(name.length + 1) })),
      })),
    }
  },
}))

import handler from '../../netlify/functions/aanmelding'

const code = 'abcdEFGH1234_-xy'
const get = (query: string, method = 'GET') =>
  handler(new Request(`https://site.com/.netlify/functions/aanmelding${query}`, { method }))
const label = (over = {}) => ({ name: 'Jansen', adres: 'A 1', postcode: '1', plaats: 'P', route: 'R', colli: 1, colliOmschrijvingen: [], spoed: false, land: 'NL', ...over })
const fotos = (naam: string, over = {}) => ({ naam, schap: 'Schap 1', fotos: [{ naam: 'a.jpg', data: 'data:image/jpeg;base64,AA' }], createdAt: Date.now(), ...over })

describe('aanmelding function', () => {
  beforeEach(() => { blobs.data = {}; blobs.orderFout = false })

  it('geeft labels met order-ID uit de order-ids-store waar die ontbreekt', async () => {
    blobs.data[`aanmeldingen:${code}/labels`] = { labels: [label(), label({ orderId: 'EIGEN' }), label()], createdAt: Date.now() }
    blobs.data[`order-ids:${code}`] = { orderIds: ['111', '222', null] }
    const res = await get(`?s=${code}&soort=labels`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const { labels } = await res.json()
    expect(labels.map((l: { orderId?: string }) => l.orderId)).toEqual(['111', 'EIGEN', undefined])
  })

  it('geeft labels ook zonder order-ID\'s of als die niet te lezen zijn', async () => {
    blobs.data[`aanmeldingen:${code}/labels`] = { labels: [label()], createdAt: Date.now() }
    expect((await get(`?s=${code}&soort=labels`)).status).toBe(200)
    blobs.orderFout = true
    const res = await get(`?s=${code}&soort=labels`)
    expect(res.status).toBe(200)
    expect((await res.json()).labels).toHaveLength(1)
  })

  it('geeft één zending met zending, alle zendingen op volgorde zonder', async () => {
    blobs.data[`aanmeldingen:${code}/fotos/10`] = fotos('Tien')
    blobs.data[`aanmeldingen:${code}/fotos/2`] = fotos('Twee')
    blobs.data[`aanmeldingen:${code}/fotos/1`] = fotos('Een')
    blobs.data['aanmeldingen:anderecode12345x/fotos/1'] = fotos('Vreemd')
    const een = await (await get(`?s=${code}&soort=fotos&zending=2`)).json()
    expect(een.zendingen.map((z: { nr: number }) => z.nr)).toEqual([2])
    expect(een.zendingen[0]).toMatchObject({ naam: 'Twee', schap: 'Schap 1' })
    const alle = await (await get(`?s=${code}&soort=fotos`)).json()
    expect(alle.zendingen.map((z: { nr: number }) => z.nr)).toEqual([1, 2, 10])
  })

  it('geeft 200 met lege lijst als de labels bestaan maar er geen foto\'s zijn', async () => {
    blobs.data[`aanmeldingen:${code}/labels`] = { labels: [label()], createdAt: Date.now() }
    for (const q of [`?s=${code}&soort=fotos`, `?s=${code}&soort=fotos&zending=3`]) {
      const res = await get(q)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ zendingen: [] })
    }
  })

  it('geeft 404 verlopen bij niet gevonden', async () => {
    for (const q of [`?s=${code}&soort=labels`, `?s=${code}&soort=fotos`, `?s=${code}&soort=fotos&zending=1`]) {
      const res = await get(q)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'verlopen' })
    }
  })

  it('geeft 404 bij verlopen data', async () => {
    const oud = Date.now() - AANMELDING_BEWAARTERMIJN_MS - 1000
    blobs.data[`aanmeldingen:${code}/labels`] = { labels: [label()], createdAt: oud }
    blobs.data[`aanmeldingen:${code}/fotos/1`] = fotos('Oud', { createdAt: oud })
    expect((await get(`?s=${code}&soort=labels`)).status).toBe(404)
    expect((await get(`?s=${code}&soort=fotos`)).status).toBe(404)
    expect((await get(`?s=${code}&soort=fotos&zending=1`)).status).toBe(404)
  })

  it('geeft 400 bij ongeldige s, soort of zending', async () => {
    for (const q of ['', '?s=kort&soort=labels', `?s=${code}`, `?s=${code}&soort=iets`,
      `?s=${code}&soort=fotos&zending=0`, `?s=${code}&soort=fotos&zending=x`, `?s=${code}&soort=fotos&zending=-1`,
      `?s=${code}&soort=fotos&zending=1.5`]) {
      expect((await get(q)).status, q).toBe(400)
    }
  })

  it('geeft 405 bij iets anders dan GET', async () => {
    expect((await get(`?s=${code}&soort=labels`, 'POST')).status).toBe(405)
  })
})
