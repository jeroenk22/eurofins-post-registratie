import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMobilePhotoSync } from '../hooks/useMobilePhotoSync'

function makeSessionResponse(photos: Record<string, unknown[]>, updatedAt: number) {
  return {
    ok: true,
    json: async () => ({ photos, updatedAt }),
  } as Response
}

describe('useMobilePhotoSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('pollt niet als enabled=false', async () => {
    const callback = vi.fn()
    renderHook(() => useMobilePhotoSync('s1', callback, false))
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('pollt meteen bij mount als enabled=true', async () => {
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({}, 0))
    const callback = vi.fn()
    renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('s1'))
  })

  it('roept callback aan als nieuwe foto binnenkomt', async () => {
    const photos = [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }]
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({ e1: photos }, 1000))
    const callback = vi.fn()
    renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(callback).toHaveBeenCalledWith('e1', photos)
  })

  it('roept callback niet opnieuw aan als updatedAt niet veranderd is', async () => {
    const photos = [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }]
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({ e1: photos }, 1000))
    const callback = vi.fn()
    renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('voegt entryId toe aan syncedEntryIds na ontvangst foto', async () => {
    const photos = [{ id: 'p1', name: 'foto.jpg', data: 'data:...' }]
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({ e1: photos }, 2000))
    const callback = vi.fn()
    const { result } = renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(result.current.has('e1')).toBe(true)
  })

  it('hersynct foto\'s niet na refresh ook als updatedAt veranderd is maar foto-IDs al bekend zijn', async () => {
    const photos = [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }]
    const callback = vi.fn()

    // Eerste mount: foto's worden gesynchroniseerd, IDs opgeslagen
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({ e1: photos }, 1000))
    const { unmount } = renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(callback).toHaveBeenCalledTimes(1)
    unmount()

    // Tweede mount (refresh): updatedAt veranderd (bijv. door QrCodeFloat push),
    // maar dezelfde foto-IDs → callback mag NIET opnieuw vuren
    callback.mockClear()
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({ e1: photos }, 2000))
    renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(callback).not.toHaveBeenCalled()
  })

  it('synct alleen nieuwe foto\'s als er extra mobiele foto\'s bijkomen na eerdere sync', async () => {
    const p1 = { id: 'p1', name: 'foto1.jpg', data: 'data:...' }
    const p2 = { id: 'p2', name: 'foto2.jpg', data: 'data:...' }
    const callback = vi.fn()

    // Eerste sync: p1 binnengekregen
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({ e1: [p1] }, 1000))
    const { unmount } = renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(callback).toHaveBeenCalledWith('e1', [p1])
    unmount()

    // Tweede sync (refresh + nieuw updatedAt): p1 + p2 op server, alleen p2 is nieuw
    callback.mockClear()
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({ e1: [p1, p2] }, 2000))
    renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(callback).toHaveBeenCalledWith('e1', [p2])
  })

  it('stopt met pollen na unmount', async () => {
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({}, 0))
    const callback = vi.fn()
    const { unmount } = renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    const callsAfterMount = vi.mocked(fetch).mock.calls.length
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(9_000))
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsAfterMount)
  })

  it('vraagt na de eerste keer alleen wat er sinds updatedAt veranderd is', async () => {
    const photos = [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSessionResponse({ e1: photos }, 1000))
      .mockResolvedValue({ ok: true, json: async () => ({ ongewijzigd: true, updatedAt: 1000 }) } as Response)
    const callback = vi.fn()
    renderHook(() => useMobilePhotoSync('s1', callback, true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(vi.mocked(fetch).mock.calls[0][0]).not.toContain('since=')

    await act(() => vi.advanceTimersByTimeAsync(1_500))
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain('since=1000')
    // "Niets veranderd" levert geen tweede callback op
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('pollt elke 1,5 seconde', async () => {
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({}, 0))
    renderHook(() => useMobilePhotoSync('s1', vi.fn(), true))
    await act(() => vi.advanceTimersByTimeAsync(100))
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('pollt niet als het tabblad niet in beeld is, en meteen bij terugkomen', async () => {
    vi.mocked(fetch).mockResolvedValue(makeSessionResponse({}, 0))
    const zichtbaarheid = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    renderHook(() => useMobilePhotoSync('s1', vi.fn(), true))
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fetch).not.toHaveBeenCalled()

    zichtbaarheid.mockReturnValue('visible')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(fetch).toHaveBeenCalledTimes(1)
    zichtbaarheid.mockRestore()
  })

  it('start geen nieuwe vraag zolang de vorige nog loopt', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {})) // antwoordt nooit
    renderHook(() => useMobilePhotoSync('s1', vi.fn(), true))
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
