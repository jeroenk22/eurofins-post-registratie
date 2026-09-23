import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchOrderIds, newSubmissionId, parseOrderIds, SUBMISSION_ID_PATTERN } from '../services/orderIds'

describe('newSubmissionId', () => {
  it('maakt een code van 16 URL-veilige tekens', () => {
    for (let i = 0; i < 50; i++) expect(newSubmissionId()).toMatch(SUBMISSION_ID_PATTERN)
  })

  it('maakt elke keer een andere code', () => {
    const ids = new Set(Array.from({ length: 200 }, newSubmissionId))
    expect(ids.size).toBe(200)
  })
})

describe('parseOrderIds', () => {
  it('neemt strings over en maakt van de rest null', () => {
    expect(parseOrderIds({ orderIds: ['1234567', null, 42, ''] })).toEqual(['1234567', null, null, null])
  })

  it('geeft een lege lijst bij een onverwachte vorm', () => {
    expect(parseOrderIds(null)).toEqual([])
    expect(parseOrderIds({})).toEqual([])
    expect(parseOrderIds({ orderIds: 'x' })).toEqual([])
  })
})

describe('fetchOrderIds', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const code = 'abcdEFGH1234_-xy'

  it('haalt de order-ID\'s op bij de aanmeldingscode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ orderIds: ['1234567', null] }) }))
    expect(await fetchOrderIds(code)).toEqual(['1234567', null])
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`/.netlify/functions/order-ids?s=${code}`)
  })

  it('vraagt niets op bij een ongeldige code', async () => {
    vi.stubGlobal('fetch', vi.fn())
    expect(await fetchOrderIds('../../etc')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('geeft een lege lijst als de code onbekend is', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchOrderIds(code)).toEqual([])
  })

  it('geeft een lege lijst bij een netwerkfout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await fetchOrderIds(code)).toEqual([])
  })

  it('geeft na de time-out op, zodat printen niet blijft wachten', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const result = fetchOrderIds(code, 4000)
    await vi.advanceTimersByTimeAsync(4000)
    expect(await result).toEqual([])
  })
})
