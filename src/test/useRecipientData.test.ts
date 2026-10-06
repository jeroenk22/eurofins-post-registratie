import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRecipientData } from '../hooks/useRecipientData'
import type { RecipientOption } from '../services/googleSheetsService'

const mockRecipients: RecipientOption[] = [
  {
    id: 'M-0',
    type: 'Monsternemers',
    label: 'M001 - Jan de Vries',
    value: 'M001 - Jan de Vries',
    searchTerms: ['M001', 'Jan', 'Vries', '1234AB', 'Amsterdam'],
    adres: 'Kerkstraat 1',
    postcode: '1234AB',
    plaats: 'Amsterdam',
    land: 'Nederland',
    route: '',
  },
]

// Mock de googleSheetsService
vi.mock('../services/googleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/googleSheetsService')>()
  return {
    ...actual,
    fetchAllRecipients: vi.fn(),
    isGoogleSheetsConfigured: vi.fn(() => true),
    loadCachedRecipients: vi.fn(() => null),
    saveRecipientsToCache: vi.fn(),
  }
})

import {
  fetchAllRecipients,
  isGoogleSheetsConfigured,
  loadCachedRecipients,
} from '../services/googleSheetsService'

describe('useRecipientData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('begint met gecachte data als die beschikbaar is', () => {
    vi.mocked(loadCachedRecipients).mockReturnValue(mockRecipients)

    const { result } = renderHook(() => useRecipientData())
    expect(result.current.recipients).toEqual(mockRecipients)
  })

  it('begint met lege lijst als cache leeg is', () => {
    vi.mocked(loadCachedRecipients).mockReturnValue(null)

    const { result } = renderHook(() => useRecipientData())
    expect(result.current.recipients).toEqual([])
  })

  it('toont eerst de cache en haalt daarna direct vers op', async () => {
    const vers = [{ ...mockRecipients[0], id: 'M-1', label: 'M002 - Nieuw adres' }]
    vi.mocked(loadCachedRecipients).mockReturnValue(mockRecipients)
    vi.mocked(fetchAllRecipients).mockResolvedValue(vers)

    const { result } = renderHook(() => useRecipientData())
    expect(result.current.recipients).toEqual(mockRecipients)

    await waitFor(() => {
      expect(result.current.recipients).toEqual(vers)
    })
    expect(fetchAllRecipients).toHaveBeenCalledOnce()
  })

  it('haalt opnieuw op bij terugkeren naar het tabblad', async () => {
    vi.mocked(fetchAllRecipients).mockResolvedValue(mockRecipients)

    renderHook(() => useRecipientData())
    await waitFor(() => expect(fetchAllRecipients).toHaveBeenCalledTimes(1))

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(fetchAllRecipients).toHaveBeenCalledTimes(2)
  })

  it('slaat fout op als fetch mislukt', async () => {
    vi.mocked(fetchAllRecipients).mockRejectedValue(new Error('Netwerk fout'))

    const { result } = renderHook(() => useRecipientData())

    await waitFor(() => {
      expect(result.current.error).toBe('Netwerk fout')
    })
  })

  it('is niet geconfigureerd: doet geen fetch', async () => {
    vi.mocked(isGoogleSheetsConfigured).mockReturnValue(false)

    renderHook(() => useRecipientData())
    await act(async () => {})

    expect(fetchAllRecipients).not.toHaveBeenCalled()
  })

  it('zet een interval op van 2 minuten', () => {
    const spy = vi.spyOn(window, 'setInterval')

    renderHook(() => useRecipientData())

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 2 * 60 * 1000)
    spy.mockRestore()
  })

  it('geeft loading: false na succesvolle fetch', async () => {
    vi.mocked(fetchAllRecipients).mockResolvedValue(mockRecipients)

    const { result } = renderHook(() => useRecipientData())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.recipients).toEqual(mockRecipients)
  })
})
