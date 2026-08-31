/**
 * Servertijd in plaats van de klok van de werkplek.
 *
 * `new Date()` neemt de klok over van de pc waarop iemand het formulier invult.
 * Loopt die klok voor of achter, dan staat er een verkeerd tijdstip op het
 * verzendlabel en in de webhook-payload — en dat merk je pas als het etiket al
 * geprint is. Daarom halen we bij het opstarten eenmalig de servertijd op en
 * onthouden we het verschil met de lokale klok.
 *
 * Lukt dat niet, dan vallen we terug op de lokale klok: een tijdstip dat
 * mogelijk afwijkt is beter dan helemaal geen tijdstip.
 */

const TIME_ENDPOINT = '/.netlify/functions/time'

let offsetMs = 0
let synced = false

export async function syncServerTime(): Promise<void> {
  try {
    const res = await fetch(TIME_ENDPOINT, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    const server = new Date(data?.now)
    if (isNaN(server.getTime())) return
    offsetMs = server.getTime() - Date.now()
    synced = true
  } catch {
    // Server niet bereikbaar — we blijven de lokale klok gebruiken.
  }
}

/** Het huidige tijdstip volgens de server, of de lokale klok als synchronisatie niet lukte. */
export function serverNow(): Date {
  return new Date(Date.now() + offsetMs)
}

/** Of de servertijd daadwerkelijk is opgehaald. */
export function isServerTimeSynced(): boolean {
  return synced
}
