import { getStore } from '@netlify/blobs'
import { AANMELDINGEN_STORE, AANMELDING_BEWAARTERMIJN_MS } from '../aanmelding-opslag'

// Bewaartermijnen (AVG). De gebruiker heeft deze op 02-10-2026 gekozen.
/** Telefoonsessies (namen en foto's): 2 dagen na de laatste wijziging. */
export const SESSIE_BEWAARTERMIJN_MS = 2 * 24 * 60 * 60 * 1000
/** Order-ID's per aanmelding: 30 dagen na het opslaan. */
export const ORDER_ID_BEWAARTERMIJN_MS = 30 * 24 * 60 * 60 * 1000

interface BlobStore {
  list(options: { paginate: true }): AsyncIterable<{ blobs: { key: string }[] }>
  get(key: string, options: { type: 'text' }): Promise<string | null>
  delete(key: string): Promise<void>
}

export interface OpruimStores {
  sessies: BlobStore
  orderIds: BlobStore
  aanmeldingen?: BlobStore
}

/** Tijdstip waarop de bewaartermijn begint; `null` als er geen bruikbaar tijdstip is. */
type LeesTijdstip = (data: Record<string, unknown>) => number | null

const positief = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

const sessieTijdstip: LeesTijdstip = (d) => (positief(d.updatedAt) ? d.updatedAt : positief(d.createdAt) ? d.createdAt : null)
const aanmeldingTijdstip: LeesTijdstip = (d) => (positief(d.createdAt) ? d.createdAt : null)
const orderIdTijdstip: LeesTijdstip = (d) => (positief(d.createdAt) ? d.createdAt : null)

async function ruimStoreOp(store: BlobStore, now: number, termijnMs: number, tijdstip: LeesTijdstip): Promise<number> {
  let verwijderd = 0
  for await (const pagina of store.list({ paginate: true })) {
    for (const { key } of pagina.blobs) {
      try {
        const raw = await store.get(key, { type: 'text' })
        if (raw === null) continue
        let t: number | null = null
        try {
          const data: unknown = JSON.parse(raw)
          if (data && typeof data === 'object' && !Array.isArray(data)) t = tijdstip(data as Record<string, unknown>)
        } catch {
          // Onleesbaar: telt als verlopen
        }
        if (t === null || now - t > termijnMs) {
          await store.delete(key)
          verwijderd++
        }
      } catch (err) {
        // Nooit namen of inhoud loggen, alleen de foutmelding
        console.error('opruimen: item overgeslagen:', err instanceof Error ? err.message : err)
      }
    }
  }
  return verwijderd
}

/** Verwijdert verlopen sessies en order-ID's. Geeft het aantal verwijderde items per store terug. */
export async function opruimen(now: number, stores: OpruimStores): Promise<{ sessies: number; orderIds: number; aanmeldingen: number }> {
  const result = { sessies: 0, orderIds: 0, aanmeldingen: 0 }
  try {
    result.sessies = await ruimStoreOp(stores.sessies, now, SESSIE_BEWAARTERMIJN_MS, sessieTijdstip)
  } catch (err) {
    console.error('opruimen: sessies mislukt:', err instanceof Error ? err.message : err)
  }
  try {
    result.orderIds = await ruimStoreOp(stores.orderIds, now, ORDER_ID_BEWAARTERMIJN_MS, orderIdTijdstip)
  } catch (err) {
    console.error("opruimen: order-ID's mislukt:", err instanceof Error ? err.message : err)
  }
  if (stores.aanmeldingen) {
    try {
      result.aanmeldingen = await ruimStoreOp(stores.aanmeldingen, now, AANMELDING_BEWAARTERMIJN_MS, aanmeldingTijdstip)
    } catch (err) {
      console.error('opruimen: aanmeldingen mislukt:', err instanceof Error ? err.message : err)
    }
  }
  console.log(`opruimen: ${result.sessies} sessies, ${result.orderIds} order-ID's en ${result.aanmeldingen} aanmeldingen verwijderd`)
  return result
}

export default async (): Promise<Response> => {
  const result = await opruimen(Date.now(), {
    sessies: getStore('mobile-sessions'),
    orderIds: getStore('order-ids'),
    aanmeldingen: getStore(AANMELDINGEN_STORE),
  })
  return new Response(JSON.stringify(result), { status: 200 })
}

export const config = { schedule: '@daily' }
