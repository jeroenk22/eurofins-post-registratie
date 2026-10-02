/// <reference types="node" />
import type { Handler, HandlerEvent } from '@netlify/functions'
import { googleAccessToken, GoogleAuthConfigError } from '../google-auth'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const TOEGESTANE_TABS = ['Monsternemers', 'AP06', 'Mestklanten']
const TOEGESTANE_KOLOMMEN = ['Code', 'Voornaam', 'Tussenvoegsel', 'Achternaam', 'Naam', 'Adres', 'Postcode', 'Plaats', 'Land', 'Route']

// Houdt alleen de toegestane kolommen over; korte rijen worden aangevuld met lege cellen
function filterKolommen(rows: string[][]): string[][] {
  if (rows.length === 0) return []
  const indexen = rows[0]
    .map((kop, i) => (TOEGESTANE_KOLOMMEN.includes(kop) ? i : -1))
    .filter(i => i >= 0)
  return rows.map(row => indexen.map(i => row[i] ?? ''))
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler: Handler = async (event: HandlerEvent) => {
  const tab = event.queryStringParameters?.tab

  if (!tab) {
    return json(400, { error: 'Missing tab parameter' })
  }
  if (!TOEGESTANE_TABS.includes(tab)) {
    return json(400, { error: 'Onbekend tabblad' })
  }

  const sheetId = process.env.GOOGLE_SHEETS_ID

  if (!sheetId) {
    return json(503, { error: 'Google Sheets niet geconfigureerd' })
  }

  try {
    const token = await googleAccessToken(SCOPE)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab}'`)}`
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) {
      // Alleen de status loggen: de body van Google kan details bevatten
      throw new Error(`Google Sheets antwoordde met HTTP ${response.status}`)
    }
    const data = await response.json()
    return json(200, { values: filterKolommen(data.values ?? []) })
  } catch (error) {
    if (error instanceof GoogleAuthConfigError) {
      return json(503, { error: 'Google Sheets niet geconfigureerd' })
    }
    console.error('Ophalen uit Google Sheets mislukt:', error instanceof Error ? error.message : 'onbekende fout')
    return json(502, { error: 'Ophalen uit Google Sheets mislukt' })
  }
}
