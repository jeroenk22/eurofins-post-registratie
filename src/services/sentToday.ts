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

const tijd = (iso: string) =>
  new Date(iso).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })

const datum = (d: Date) =>
  d.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: '2-digit', month: '2-digit', year: 'numeric' })

function regel(item: SentItem): string {
  const l = item.label
  const delen = [
    tijd(item.sentAt),
    item.orderId ? `Order ${item.orderId}` : 'Geen ordernummer',
    l.name,
    l.route,
    `${l.colli} colli${l.colliOmschrijvingen.length ? `: ${l.colliOmschrijvingen.slice(0, l.colli).join(', ')}` : ''}`,
    l.spoed ? 'SPOED' : '',
  ]
  return delen.filter(Boolean).join(' – ')
}

// Outlook en browsers kappen lange mailto-links af; ruim eronder blijven.
const MAX_MAILTO_LENGTH = 1900

/**
 * mailto-link met het overzicht van vandaag. De gebruiker verstuurt de mail zelf
 * vanuit zijn mailprogramma; Make komt er niet aan te pas.
 */
export function dagoverzichtMailto(items: SentItem[], to: string, cc: string, now: Date = serverNow()): string {
  const oudsteEerst = [...items].reverse()
  const onderwerp = `[Postapp] Dagoverzicht ${datum(now)} – ${items.length} ${items.length === 1 ? 'zending' : 'zendingen'}`
  const bouw = (regels: string[], weggelaten: number) => {
    const tekst = [
      `Verzonden op ${datum(now)}:`,
      '',
      ...regels,
      ...(weggelaten > 0 ? ['', `… en nog ${weggelaten} (zie "Vandaag verzonden" in de app).`] : []),
    ].join('\n')
    const params = [
      cc.trim() && `cc=${encodeURIComponent(cc.trim())}`,
      `subject=${encodeURIComponent(onderwerp)}`,
      `body=${encodeURIComponent(tekst)}`,
    ].filter(Boolean)
    return `mailto:${encodeURIComponent(to.trim())}?${params.join('&')}`
  }

  const regels = oudsteEerst.map(regel)
  for (let n = regels.length; n > 0; n--) {
    const link = bouw(regels.slice(0, n), regels.length - n)
    if (link.length <= MAX_MAILTO_LENGTH) return link
  }
  return bouw([], regels.length)
}
