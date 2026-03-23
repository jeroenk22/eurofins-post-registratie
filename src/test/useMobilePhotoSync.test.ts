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
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
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
})
