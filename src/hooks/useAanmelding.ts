import { useCallback, useEffect, useState } from 'react'
import { AanmeldingError, type AanmeldingFout } from '../services/aanmelding'

export type AanmeldingState<T> =
  | { status: 'laden' }
  | { status: 'klaar'; data: T }
  | { status: 'fout'; fout: AanmeldingFout }

/** Laadt gegevens van een aanmelding; `opnieuw` probeert het nog eens. */
export function useAanmelding<T>(laad: () => Promise<T>, sleutel: string) {
  const [state, setState] = useState<AanmeldingState<T>>({ status: 'laden' })
  const [poging, setPoging] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'laden' })
    laad().then(
      (data) => { if (!cancelled) setState({ status: 'klaar', data }) },
      (e: unknown) => {
        if (!cancelled) setState({ status: 'fout', fout: e instanceof AanmeldingError ? e.soort : 'andere' })
      },
    )
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel, poging])

  const opnieuw = useCallback(() => setPoging((p) => p + 1), [])
  return { state, opnieuw }
}
