import { getStore } from '@netlify/blobs'

export interface MobileEntry {
  id: string
  name: string
  colli: number
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

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export default async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: HEADERS })
  }

  try {
    const store = getStore('mobile-sessions')
    const url = new URL(request.url)

    if (request.method === 'GET') {
      const id = url.searchParams.get('id')
      if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: HEADERS })
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

      if (!body.id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: HEADERS })

      // Upsert entries (preserves existing photos)
      if (body.entries !== undefined) {
        const raw = await store.get(body.id, { type: 'text' })
        const existing: SessionData = raw
          ? (JSON.parse(raw) as SessionData)
          : { entries: [], photos: {}, createdAt: Date.now(), updatedAt: 0 }
        existing.entries = body.entries
        existing.updatedAt = Date.now()
        await store.set(body.id, JSON.stringify(existing))
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
        await store.set(body.id, JSON.stringify(session))
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
