import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'

const auth = vi.hoisted(() => ({ ctor: vi.fn(), getAccessToken: vi.fn() }))
vi.mock('google-auth-library', () => ({
  JWT: class {
    constructor(opts: unknown) { auth.ctor(opts) }
    getAccessToken = auth.getAccessToken
  },
}))


const fetchMock = vi.fn()
let handler: typeof import('../../netlify/functions/sheets').handler
const get = (tab?: string) =>
  handler({ queryStringParameters: tab ? { tab } : {} } as unknown as HandlerEvent, {} as HandlerContext) as Promise<{ statusCode: number; body: string }>

const sheetAntwoord = (values: string[][]) => ({ ok: true, status: 200, json: async () => ({ values }) })

describe('sheets function', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.resetModules() // de JWT-client wordt per module gecachet
    handler = (await import('../../netlify/functions/sheets')).handler
    vi.stubGlobal('fetch', fetchMock)
    process.env.GOOGLE_SHEETS_ID = 'sheet-id'
    process.env.GOOGLE_SA_EMAIL = 'sa@project.iam.gserviceaccount.com'
    process.env.GOOGLE_SA_PRIVATE_KEY = 'regel1\\nregel2'
    auth.getAccessToken.mockResolvedValue({ token: 'tok123' })
  })

  it('weigert een onbekend tabblad en Toegang met 400', async () => {
    for (const tab of ['Onbekend', 'Toegang']) {
      const res = await get(tab)
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body)).toEqual({ error: 'Onbekend tabblad' })
    }
    expect((await get()).statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('geeft 503 als een env var ontbreekt', async () => {
    for (const naam of ['GOOGLE_SHEETS_ID', 'GOOGLE_SA_EMAIL', 'GOOGLE_SA_PRIVATE_KEY']) {
      const waarde = process.env[naam]
      delete process.env[naam]
      const res = await get('AP06')
      expect(res.statusCode).toBe(503)
      expect(JSON.parse(res.body)).toEqual({ error: 'Google Sheets niet geconfigureerd' })
      process.env[naam] = waarde
    }
  })

  it('geeft alleen toegestane kolommen terug, ook bij korte rijen', async () => {
    fetchMock.mockResolvedValue(sheetAntwoord([
      ['Code', 'Geheim', 'Naam', 'Telefoon', 'Route'],
      ['A1', 'x', 'Jansen', '06-123', '7'],
      ['A2', 'y', 'Pietersen'],
    ]))
    const res = await get('Mestklanten')
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ values: [['Code', 'Naam', 'Route'], ['A1', 'Jansen', '7'], ['A2', 'Pietersen', '']] })
  })

  it('geeft een lege lijst bij een lege sheet', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    expect(JSON.parse((await get('AP06')).body)).toEqual({ values: [] })
  })

  it('zet letterlijke \\n in de key om naar echte newlines', async () => {
    fetchMock.mockResolvedValue(sheetAntwoord([]))
    await get('AP06')
    expect(auth.ctor).toHaveBeenCalledWith(expect.objectContaining({
      email: 'sa@project.iam.gserviceaccount.com',
      key: 'regel1\nregel2',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    }))
  })

  it('laat echte newlines in de key ongemoeid', async () => {
    process.env.GOOGLE_SA_PRIVATE_KEY = 'echt1\necht2'
    fetchMock.mockResolvedValue(sheetAntwoord([]))
    await get('AP06')
    expect(auth.ctor).toHaveBeenCalledWith(expect.objectContaining({ key: 'echt1\necht2' }))
  })

  it('stuurt het token mee als Bearer-header', async () => {
    fetchMock.mockResolvedValue(sheetAntwoord([]))
    await get('Monsternemers')
    const [url, opties] = fetchMock.mock.calls[0]
    expect(url).toBe("https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/'Monsternemers'")
    expect(opties.headers).toEqual({ Authorization: 'Bearer tok123' })
  })

  it('geeft 502 zonder Google-tekst als Google een fout geeft', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => 'geheime Google-fouttekst sheet-id' })
    const res = await get('AP06')
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body)).toEqual({ error: 'Ophalen uit Google Sheets mislukt' })
    expect(res.body).not.toContain('geheime')
    expect(res.body).not.toContain('sheet-id')
  })

  it('geeft 502 zonder details als de token-aanvraag faalt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.getAccessToken.mockRejectedValue(new Error('invalid_grant geheim'))
    const res = await get('AP06')
    expect(res.statusCode).toBe(502)
    expect(res.body).not.toContain('geheim')
  })
})
