import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Elke test krijgt een verse module-instantie, zodat de opgeslagen offset niet lekt.
async function freshModule() {
  vi.resetModules()
  return await import('../services/serverTime')
}

describe('serverTime', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('gebruikt de lokale klok zolang er niet gesynchroniseerd is', async () => {
    const { serverNow, isServerTimeSynced } = await freshModule()
    vi.setSystemTime(new Date('2026-08-31T11:23:00.000Z'))
    expect(isServerTimeSynced()).toBe(false)
    expect(serverNow().toISOString()).toBe('2026-08-31T11:23:00.000Z')
  })

  it('corrigeert een voorlopende werkplekklok naar de servertijd', async () => {
    const { syncServerTime, serverNow, isServerTimeSynced } = await freshModule()
    // Werkplek staat 9 minuten voor op de server
    vi.setSystemTime(new Date('2026-08-31T11:23:00.000Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ now: '2026-08-31T11:14:00.000Z' }),
    }))

    await syncServerTime()

    expect(isServerTimeSynced()).toBe(true)
    expect(serverNow().toISOString()).toBe('2026-08-31T11:14:00.000Z')
  })

  it('laat de klok verder gewoon doorlopen na het synchroniseren', async () => {
    const { syncServerTime, serverNow } = await freshModule()
    vi.setSystemTime(new Date('2026-08-31T11:23:00.000Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ now: '2026-08-31T11:14:00.000Z' }),
    }))
    await syncServerTime()

    vi.advanceTimersByTime(30_000)
    expect(serverNow().toISOString()).toBe('2026-08-31T11:14:30.000Z')
  })

  it('valt terug op de lokale klok als de server onbereikbaar is', async () => {
    const { syncServerTime, serverNow, isServerTimeSynced } = await freshModule()
    vi.setSystemTime(new Date('2026-08-31T11:23:00.000Z'))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await syncServerTime()

    expect(isServerTimeSynced()).toBe(false)
    expect(serverNow().toISOString()).toBe('2026-08-31T11:23:00.000Z')
  })

  it('valt terug op de lokale klok bij een foutstatus', async () => {
    const { syncServerTime, serverNow, isServerTimeSynced } = await freshModule()
    vi.setSystemTime(new Date('2026-08-31T11:23:00.000Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))

    await syncServerTime()

    expect(isServerTimeSynced()).toBe(false)
    expect(serverNow().toISOString()).toBe('2026-08-31T11:23:00.000Z')
  })

  it('valt terug op de lokale klok bij een onbruikbaar antwoord', async () => {
    const { syncServerTime, serverNow, isServerTimeSynced } = await freshModule()
    vi.setSystemTime(new Date('2026-08-31T11:23:00.000Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ now: 'geen datum' }),
    }))

    await syncServerTime()

    expect(isServerTimeSynced()).toBe(false)
    expect(serverNow().toISOString()).toBe('2026-08-31T11:23:00.000Z')
  })

  it('vraagt de tijd op zonder cache', async () => {
    const { syncServerTime } = await freshModule()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ now: '2026-08-31T11:14:00.000Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncServerTime()

    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/time', { cache: 'no-store' })
  })
})
