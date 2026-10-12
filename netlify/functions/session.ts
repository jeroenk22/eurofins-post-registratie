import { getStore } from '@netlify/blobs'

export interface MobileEntry {
  id: string
  name: string
  colli: number
  colliOmschrijvingen: string[]
  desktopPhotoCount: number
}

export interface MobilePhoto {
  id: string
  name: string
  data: string
}

export interface SessionData {
  entries: MobileEntry[]
  photos: Record<string, MobilePhoto[]>
  createdAt: number
  updatedAt: number
}

/** Zelfde vorm als newSessionId() in de app: 16 bytes, 22 tekens base64url. */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/

const HEADERS = {
  'Content-Type': 'application/json',
}

const MAX_POGINGEN = 5

/**
 * Lezen, aanpassen en terugschrijven, maar alleen als de sessie intussen niet
 * door een ander verzoek is gewijzigd (ETag); anders opnieuw. Let op: Netlify
 * Blobs houdt écht gelijktijdige schrijfacties hiermee níet altijd tegen (getest:
 * vaak slagen ze alle vier). Daarom uploadt de telefoon de zendingen na elkaar;
 * dit vangt vooral een overlap met de desktop af.
 * `updatedAt` gaat ook in de metadata: dan kan een GET met `since` antwoorden
 * zonder de foto's te lezen.
 */
async function wijzig(
  store: ReturnType<typeof getStore>,
  id: string,
  aanpassen: (session: SessionData) => void,
): Promise<void> {
  for (let poging = 1; poging <= MAX_POGINGEN; poging++) {
    const huidig = await store.getWithMetadata(id, { type: 'text' })
    const session: SessionData = huidig
      ? (JSON.parse(huidig.data) as SessionData)
      : { entries: [], photos: {}, createdAt: Date.now(), updatedAt: 0 }
    aanpassen(session)
    session.updatedAt = Date.now()
    const voorwaarde = huidig?.etag ? { onlyIfMatch: huidig.etag } : { onlyIfNew: true }
    const { modified } = await store.set(id, JSON.stringify(session), {
      ...voorwaarde,
      metadata: { updatedAt: session.updatedAt },
    })
    if (modified) return
  }
  throw new Error('Sessie te vaak tegelijk gewijzigd')
}

function ongeldigeSessie(): Response {
  return new Response(JSON.stringify({ error: 'Ongeldige sessie' }), { status: 400, headers: HEADERS })
}

export default async (request: Request): Promise<Response> => {
  try {
    // Strong: standaard leest Blobs een gecachte versie, en dan zag de desktop nieuwe
    // foto's pas seconden later (een nieuwe sessie soms pas na een halve minuut).
    // Ook de POST-handlers lezen eerst; met een oude versie zouden ze nieuwere data overschrijven.
    const store = getStore('mobile-sessions', { consistency: 'strong' })
    const url = new URL(request.url)

    if (request.method === 'GET') {
      const id = url.searchParams.get('id')
      if (!id || !SESSION_ID_PATTERN.test(id)) return ongeldigeSessie()
      // De desktop vraagt elke paar seconden. Is er sinds `since` niets veranderd,
      // dan alleen dat: de sessie zelf kan megabytes aan foto's bevatten.
      const since = Number(url.searchParams.get('since'))
      if (since > 0) {
        const meta = await store.getMetadata(id)
        if (!meta) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: HEADERS })
        const updatedAt = meta.metadata.updatedAt
        // Sessies van vóór deze metadata hebben geen updatedAt: dan gewoon alles sturen
        if (typeof updatedAt === 'number' && updatedAt <= since) {
          return new Response(JSON.stringify({ ongewijzigd: true, updatedAt }), { status: 200, headers: HEADERS })
        }
      }
      const raw = await store.get(id, { type: 'text' })
      if (!raw) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: HEADERS })
      return new Response(raw, { status: 200, headers: HEADERS })
    }

    if (request.method === 'POST') {
      const body = await request.json() as {
        id: string
        entries?: MobileEntry[]
        entryId?: string
        photos?: MobilePhoto[]
      }

      if (typeof body.id !== 'string' || !SESSION_ID_PATTERN.test(body.id)) return ongeldigeSessie()

      // Upsert entries (preserves existing photos)
      if (body.entries !== undefined) {
        const entries = body.entries
        await wijzig(store, body.id, session => { session.entries = entries })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS })
      }

      // Store photos for a specific entry (upsert: maakt sessie aan als die niet bestaat)
      if (body.entryId !== undefined && body.photos !== undefined) {
        const { entryId, photos } = body
        await wijzig(store, body.id, session => { session.photos[entryId] = photos })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS })
      }

      return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: HEADERS })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS })
  } catch (err) {
    console.error('Session error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: HEADERS },
    )
  }
}
