import type { PrintEntry } from './printService'
import { serverNow } from './serverTime'

/**
 * Wat er vandaag vanaf deze werkplek verzonden is (desktop). Staat in
 * localStorage, zonder foto's: alleen wat nodig is om het label opnieuw te
 * printen. Bij een nieuwe dag begint de lijst leeg.
 */
const KEY = 'verzonden_vandaag'

export interface SentItem {
  id: string
  /** Verzendtijdstip (ISO), hetzelfde als op het label. */
  sentAt: string
  /** Miedema/Mendrix-ordernummer; `null` als de order niet is aangemaakt. */
  orderId: string | null
  /** Labelgegevens, inclusief het order-ID voor de QR-code. */
  label: PrintEntry
}

interface Stored {
  day: string
  items: SentItem[]
}

/** Kalenderdag in Nederland (YYYY-MM-DD), zodat "vandaag" niet in UTC omslaat. */
export function dayKey(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
}

/** Nieuwste eerst. */
export function loadSentToday(now: Date = serverNow()): SentItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null
    if (!stored || stored.day !== dayKey(now) || !Array.isArray(stored.items)) return []
    return stored.items
  } catch {
    return []
  }
}

/** Zet een verzonden zending bovenaan de lijst van vandaag en geeft de nieuwe lijst. */
export function addSentToday(item: SentItem, now: Date = serverNow()): SentItem[] {
  const items = [item, ...loadSentToday(now)]
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: dayKey(now), items } satisfies Stored))
  } catch {
    // Geen opslag: de lijst leeft dan alleen tot de pagina sluit.
  }
  return items
}
