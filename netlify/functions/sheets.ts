/// <reference types="node" />
import type { Handler, HandlerEvent } from '@netlify/functions'

export const handler: Handler = async (event: HandlerEvent) => {
  const tab = event.queryStringParameters?.tab

  if (!tab) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing tab parameter' }) }
  }

  const sheetId = process.env.GOOGLE_SHEETS_ID
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY

  if (!sheetId || !apiKey) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Google Sheets niet geconfigureerd' }) }
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab}'`)}?key=${apiKey}`

  const response = await fetch(url)
  const data = await response.json()

  return {
    statusCode: response.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}
