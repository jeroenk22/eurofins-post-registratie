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

/** `updatedAt` ook als metadata: dan kan een GET met `since` antwoorden zonder de foto's te lezen. */
function bewaar(store: ReturnType<typeof getStore>, id: string, session: SessionData): Promise<unknown> {
  return store.set(id, JSON.stringify(session), { metadata: { updatedAt: session.updatedAt } })
}

function ongeldigeSessie(): Response {
  return new Response(JSON.stringify({ error: 'Ongeldige sessie' }), { status: 400, headers: HEADERS })
}

export default async (request: Request): Promise<Response> => {
  try {
    const store = getStore('mobile-sessions')
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
        const raw = await store.get(body.id, { type: 'text' })
        const existing: SessionData = raw
          ? (JSON.parse(raw) as SessionData)
          : { entries: [], photos: {}, createdAt: Date.now(), updatedAt: 0 }
        existing.entries = body.entries
        existing.updatedAt = Date.now()
        await bewaar(store, body.id, existing)
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS })
      }

      // Store photos for a specific entry (upsert: maakt sessie aan als die niet bestaat)
      if (body.entryId !== undefined && body.photos !== undefined) {
        const raw = await store.get(body.id, { type: 'text' })
        const session: SessionData = raw
          ? (JSON.parse(raw) as SessionData)
          : { entries: [], photos: {}, createdAt: Date.now(), updatedAt: 0 }
        session.photos[body.entryId] = body.photos
        session.updatedAt = Date.now()
        await bewaar(store, body.id, session)
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
