import { useState, useEffect, useCallback } from 'react'
import {
  fetchAllRecipients,
  loadCachedRecipients,
  saveRecipientsToCache,
  isCacheStale,
  isGoogleSheetsConfigured,
  type RecipientOption,
} from '../services/googleSheetsService'

const REFRESH_INTERVAL_MS = 10 * 60 * 1000

export interface UseRecipientDataResult {
  recipients: RecipientOption[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRecipientData(): UseRecipientDataResult {
  const [recipients, setRecipients] = useState<RecipientOption[]>(
    () => loadCachedRecipients() ?? []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isGoogleSheetsConfigured()) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllRecipients()
      setRecipients(data)
      saveRecipientsToCache(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij laden ontvangersdata')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isCacheStale()) {
      refresh()
    }
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  return { recipients, loading, error, refresh }
}
