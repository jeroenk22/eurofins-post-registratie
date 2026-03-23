/// <reference types="node" />
import type { Handler, HandlerEvent } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

export interface MobileEntry {
  id: string
  name: string
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

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' }
  }

  try {
    const store = getStore('mobile-sessions')

    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id
      if (!id) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing id' }) }
      const raw = await store.get(id)
      if (!raw) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Not found' }) }
      return { statusCode: 200, headers: HEADERS, body: raw }
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as {
        id: string
        entries?: MobileEntry[]
        entryId?: string
        photos?: MobilePhoto[]
      }

      if (!body.id) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing id' }) }

      // Upsert entries (preserves existing photos)
      if (body.entries !== undefined) {
        const raw = await store.get(body.id)
        const existing: SessionData = raw
          ? (JSON.parse(raw) as SessionData)
          : { entries: [], photos: {}, createdAt: Date.now(), updatedAt: 0 }
        existing.entries = body.entries
        existing.updatedAt = Date.now()
        await store.set(body.id, JSON.stringify(existing))
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) }
      }

      // Store photos for a specific entry
      if (body.entryId !== undefined && body.photos !== undefined) {
        const raw = await store.get(body.id)
        if (!raw) return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Not found' }) }
        const session = JSON.parse(raw) as SessionData
        session.photos[body.entryId] = body.photos
        session.updatedAt = Date.now()
        await store.set(body.id, JSON.stringify(session))
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) }
      }

      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid body' }) }
    }

    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (err) {
    console.error('Session error:', err)
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
    }
  }
}
