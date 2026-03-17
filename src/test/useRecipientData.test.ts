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
    isCacheStale: vi.fn(() => true),
  }
})

import {
  fetchAllRecipients,
  isGoogleSheetsConfigured,
  loadCachedRecipients,
  isCacheStale,
} from '../services/googleSheetsService'

describe('useRecipientData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('begint met gecachte data als die beschikbaar is', () => {
    vi.mocked(loadCachedRecipients).mockReturnValue(mockRecipients)
    vi.mocked(isCacheStale).mockReturnValue(false)

    const { result } = renderHook(() => useRecipientData())
    expect(result.current.recipients).toEqual(mockRecipients)
  })

  it('begint met lege lijst als cache leeg is', () => {
    vi.mocked(loadCachedRecipients).mockReturnValue(null)

    const { result } = renderHook(() => useRecipientData())
    expect(result.current.recipients).toEqual([])
  })

  it('fetcht vers als cache verlopen is', async () => {
    vi.mocked(fetchAllRecipients).mockResolvedValue(mockRecipients)
    vi.mocked(isCacheStale).mockReturnValue(true)

    const { result } = renderHook(() => useRecipientData())

    await waitFor(() => {
      expect(result.current.recipients).toEqual(mockRecipients)
    })
    expect(fetchAllRecipients).toHaveBeenCalledOnce()
  })

  it('fetcht niet als cache nog geldig is', async () => {
    vi.mocked(isCacheStale).mockReturnValue(false)
    vi.mocked(loadCachedRecipients).mockReturnValue(mockRecipients)

    renderHook(() => useRecipientData())
    await act(async () => {})

    expect(fetchAllRecipients).not.toHaveBeenCalled()
  })

  it('slaat fout op als fetch mislukt', async () => {
    vi.mocked(fetchAllRecipients).mockRejectedValue(new Error('Netwerk fout'))
    vi.mocked(isCacheStale).mockReturnValue(true)

    const { result } = renderHook(() => useRecipientData())

    await waitFor(() => {
      expect(result.current.error).toBe('Netwerk fout')
    })
  })

  it('is niet geconfigureerd: doet geen fetch', async () => {
    vi.mocked(isGoogleSheetsConfigured).mockReturnValue(false)
    vi.mocked(isCacheStale).mockReturnValue(true)

    renderHook(() => useRecipientData())
    await act(async () => {})

    expect(fetchAllRecipients).not.toHaveBeenCalled()
  })

  it('zet een interval op van 10 minuten', () => {
    const spy = vi.spyOn(window, 'setInterval')
    vi.mocked(isCacheStale).mockReturnValue(false)

    renderHook(() => useRecipientData())

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 10 * 60 * 1000)
    spy.mockRestore()
  })

  it('geeft loading: false na succesvolle fetch', async () => {
    vi.mocked(fetchAllRecipients).mockResolvedValue(mockRecipients)
    vi.mocked(isCacheStale).mockReturnValue(true)

    const { result } = renderHook(() => useRecipientData())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.recipients).toEqual(mockRecipients)
  })
})
