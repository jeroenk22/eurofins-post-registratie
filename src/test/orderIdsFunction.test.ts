import { describe, it, expect, vi, beforeEach } from 'vitest'

const blobs = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@netlify/blobs', () => ({ getStore: () => ({ get: blobs.get }) }))

import handler from '../../netlify/functions/order-ids'

const code = 'abcdEFGH1234_-xy'
const get = (query: string) => handler(new Request(`https://site.com/.netlify/functions/order-ids${query}`))

describe('order-ids function', () => {
  beforeEach(() => { blobs.get.mockReset() })

  it('geeft de bewaarde order-ID\'s terug', async () => {
    blobs.get.mockResolvedValue({ orderIds: ['1234567', null], createdAt: 1 })
    const res = await get(`?s=${code}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ orderIds: ['1234567', null] })
    expect(blobs.get).toHaveBeenCalledWith(code, { type: 'json' })
  })

  it('geeft alleen de ID\'s terug, niet de rest van wat er bewaard is', async () => {
    blobs.get.mockResolvedValue({ orderIds: ['1'], createdAt: 1 })
    expect(Object.keys(await (await get(`?s=${code}`)).json())).toEqual(['orderIds'])
  })

  it('geeft 404 bij een onbekende code', async () => {
    blobs.get.mockResolvedValue(null)
    expect((await get(`?s=${code}`)).status).toBe(404)
  })

  it('weigert een ontbrekende of ongeldige code zonder op te zoeken', async () => {
    expect((await get('')).status).toBe(400)
    expect((await get('?s=kort')).status).toBe(400)
    expect((await get('?s=..%2F..%2Fabcdefghijkl')).status).toBe(400)
    expect(blobs.get).not.toHaveBeenCalled()
  })

  it('geeft 405 bij iets anders dan GET', async () => {
    const res = await handler(new Request(`https://site.com/.netlify/functions/order-ids?s=${code}`, { method: 'POST' }))
    expect(res.status).toBe(405)
  })

  it('geeft 500 zonder foutdetails als de opslag faalt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    blobs.get.mockImplementation(async () => { throw new Error('geheime interne fout') })
    const res = await get(`?s=${code}`)
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('geheime')
  })
})
