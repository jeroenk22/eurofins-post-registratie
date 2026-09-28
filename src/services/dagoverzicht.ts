import type { SentItem } from './sentToday'
import { encodePrintData } from './printService'

/**
 * Laat de functie `dagoverzicht` het overzicht van vandaag als opgemaakte mail
 * versturen (via een apart Make-scenario). Gooit een Error met een leesbare
 * melding als het niet lukt.
 */
export async function mailDagoverzicht(items: SentItem[], to: string, cc: string, senderName: string): Promise<void> {
  const res = await fetch('/.netlify/functions/dagoverzicht', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: to.trim(),
      cc: cc.trim(),
      senderName: senderName.trim(),
      items: items.map(i => ({
        sentAt: i.sentAt,
        orderId: i.orderId,
        name: i.label.name,
        route: i.label.route,
        colli: i.label.colli,
        colliOmschrijvingen: i.label.colliOmschrijvingen.slice(0, i.label.colli),
        spoed: i.label.spoed,
      })),
      // Voor de knop "Alle labels printen" in de mail; de labels bevatten het
      // order-ID, dus de printpagina zet de QR-codes er zelf op.
      printData: encodePrintData([...items].reverse().map(i => i.label)),
    }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Versturen mislukt (${res.status})`)
  }
}
