import { useState, useEffect, useCallback } from 'react'
import {
  fetchAllRecipients,
  loadCachedRecipients,
  saveRecipientsToCache,
  isGoogleSheetsConfigured,
  type RecipientOption,
} from '../services/googleSheetsService'

const REFRESH_INTERVAL_MS = 2 * 60 * 1000

export interface UseRecipientDataResult {
  recipients: RecipientOption[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRecipientData(): UseRecipientDataResult {
  // De gecachte lijst is direct bruikbaar; de verse lijst komt er meteen achteraan
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

  // Nieuwe adressen in de sheet moeten snel vindbaar zijn: ophalen bij openen
  // van de app, bij terugkeren naar het tabblad en daarnaast elke 2 minuten.
  useEffect(() => {
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  return { recipients, loading, error, refresh }
}
