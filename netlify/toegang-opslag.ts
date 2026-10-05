/**
 * Afspraken tussen de edge function ip-guard (registreert netwerken, leest de
 * toegangslijst) en de geplande functie sync-toegang (zet netwerken in de
 * toegangs-sheet en schrijft de lijst met "ja"-netwerken terug).
 */

/** Blob-store met per dag de netwerken die een beschermd eindpunt aanriepen. */
export const NETWERKEN_STORE = 'netwerken'

/** Blob-store met de lijst toegestane netwerken, door sync-toegang gevuld. */
export const TOEGANG_STORE = 'toegang'
export const LIJST_KEY = 'lijst'

export interface ToegangsLijst {
  /** Netwerken zoals netwerkVan() ze schrijft: IPv4-adres of IPv6-/64-prefix. */
  netwerken: string[]
  /** Tijdstip (ms) waarop sync-toegang de lijst schreef. */
  bijgewerkt: number
}

/** Datum in Nederlandse tijd, als JJJJ-MM-DD. */
export function vandaag(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Sleutel in NETWERKEN_STORE: één per netwerk per dag. */
export function netwerkKey(datum: string, netwerk: string): string {
  return `${datum}/${encodeURIComponent(netwerk)}`
}

export function leesNetwerkKey(key: string): { datum: string; netwerk: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})\/(.+)$/.exec(key)
  if (!match) return null
  try {
    return { datum: match[1], netwerk: decodeURIComponent(match[2]) }
  } catch {
    return null
  }
}
