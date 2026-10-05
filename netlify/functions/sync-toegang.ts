/// <reference types="node" />
import { getStore } from '@netlify/blobs'
import { googleAccessToken } from '../google-auth'
import {
  NETWERKEN_STORE, TOEGANG_STORE, LIJST_KEY, leesNetwerkKey, vandaag, type ToegangsLijst,
} from '../toegang-opslag'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TAB = 'Netwerken'
const KOPREGEL = ['Netwerk', 'Eerst gezien', 'Laatst gezien', 'Aantal dagen', 'Toegestaan', 'Omschrijving']
const VERPLICHTE_KOLOMMEN = ['Netwerk', 'Eerst gezien', 'Laatst gezien', 'Aantal dagen', 'Toegestaan']

/** Bewaartermijn IP-adressen (AVG), gekozen in het veiligheidsplan. Geldt niet voor rijen met "ja". */
export const BEWAARTERMIJN_DAGEN = 60

const DAG_MS = 24 * 60 * 60 * 1000

export interface Cel { rij: number; kolom: number; waarde: string }

/** Kleine Sheets-client; rij en kolom zijn 0-gebaseerd. */
export interface SheetsClient {
  /** gid van het tabblad, of null als het tabblad niet bestaat. */
  sheetId(tab: string): Promise<number | null>
  lees(tab: string): Promise<string[][]>
  schrijf(tab: string, cellen: Cel[]): Promise<void>
  voegToe(tab: string, rijen: string[][]): Promise<void>
  verwijderRijen(sheetId: number, rijen: number[]): Promise<void>
}

interface LeesStore {
  list(options: { paginate: true }): AsyncIterable<{ blobs: { key: string }[] }>
  delete(key: string): Promise<void>
}

export interface SyncDeps {
  sheets: SheetsClient
  netwerken: LeesStore
  toegang: { setJSON(key: string, value: ToegangsLijst): Promise<unknown> }
}

export interface SyncResultaat { nieuw: number; bijgewerkt: number; verwijderd: number; toegestaan: number }

// ---- Datums ----

const isoNaarDagen = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / DAG_MS

/** Leest dd-mm-jjjj, jjjj-mm-dd of een Sheets-datumgetal; geeft JJJJ-MM-DD of null. */
export function leesDatum(raw: string): string | null {
  const tekst = raw.trim()
  let j: string, m: string, d: string
  let match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(tekst)
  if (match) [, d, m, j] = match
  else if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tekst))) [, j, m, d] = match
  else if (/^\d+(\.\d+)?$/.test(tekst) && Number(tekst) > 0) {
    // Sheets telt dagen vanaf 30-12-1899
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(tekst)) * DAG_MS).toISOString().slice(0, 10)
  } else return null
  const iso = `${j}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const datum = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(datum.getTime()) || datum.toISOString().slice(0, 10) !== iso ? null : iso
}

/** JJJJ-MM-DD naar dd-mm-jjjj, zoals de beheerder het leest. */
const toonDatum = (iso: string): string => iso.split('-').reverse().join('-')

// ---- Sheet-rijen ----

interface Kolommen { netwerk: number; eerst: number; laatst: number; aantal: number; toegestaan: number; breedte: number }

function zoekKolommen(kop: string[]): Kolommen | null {
  const index = (naam: string) => kop.findIndex((k) => k.trim().toLowerCase() === naam.toLowerCase())
  const k = {
    netwerk: index('Netwerk'), eerst: index('Eerst gezien'), laatst: index('Laatst gezien'),
    aantal: index('Aantal dagen'), toegestaan: index('Toegestaan'),
  }
  if (Object.values(k).some((i) => i < 0)) return null
  return { ...k, breedte: Math.max(kop.length, ...Object.values(k).map((i) => i + 1)) }
}

const sleutelVan = (netwerk: string) => netwerk.trim().toLowerCase()
const isJa = (waarde: string | undefined) => (waarde ?? '').trim().toLowerCase() === 'ja'

interface Registratie { netwerk: string; datums: Set<string>; keys: string[] }

/** Leest NETWERKEN_STORE: per netwerk (genormaliseerd) de unieke datums en de blob-sleutels. */
async function leesRegistraties(store: LeesStore): Promise<{ perNetwerk: Map<string, Registratie>; alleKeys: string[] }> {
  const perNetwerk = new Map<string, Registratie>()
  const alleKeys: string[] = []
  for await (const pagina of store.list({ paginate: true })) {
    for (const { key } of pagina.blobs) {
      alleKeys.push(key)
      const gelezen = leesNetwerkKey(key)
      if (!gelezen) continue
      const id = sleutelVan(gelezen.netwerk)
      const item = perNetwerk.get(id) ?? { netwerk: gelezen.netwerk.trim(), datums: new Set<string>(), keys: [] }
      item.datums.add(gelezen.datum)
      item.keys.push(key)
      perNetwerk.set(id, item)
    }
  }
  return { perNetwerk, alleKeys }
}

interface Plan { cellen: Cel[]; nieuweRijen: string[][]; bijgewerkt: number; keys: string[] }

/** Stap A (rekenen): wat moet er in de sheet? Past alleen bestaande rijen in `rijen` aan, schrijft niets. */
function maakPlan(perNetwerk: Map<string, Registratie>, alleKeys: string[], rijen: string[][], kol: Kolommen): Plan {
  const rijVan = new Map<string, number>()
  rijen.forEach((rij, i) => {
    const id = sleutelVan(rij[kol.netwerk] ?? '')
    if (i > 0 && id && !rijVan.has(id)) rijVan.set(id, i)
  })

  const plan: Plan = { cellen: [], nieuweRijen: [], bijgewerkt: 0, keys: alleKeys }
  for (const [id, reg] of perNetwerk) {
    const datums = [...reg.datums].sort()
    const i = rijVan.get(id)
    if (i === undefined) {
      const rij = Array<string>(kol.breedte).fill('')
      rij[kol.netwerk] = reg.netwerk
      rij[kol.eerst] = toonDatum(datums[0])
      rij[kol.laatst] = toonDatum(datums[datums.length - 1])
      rij[kol.aantal] = String(datums.length)
      plan.nieuweRijen.push(rij)
      continue
    }
    const rij = rijen[i]
    const laatst = leesDatum(rij[kol.laatst] ?? '')
    const nieuweDatums = datums.filter((d) => !laatst || d > laatst)
    if (nieuweDatums.length === 0) continue
    const aantal = (Number.parseInt(rij[kol.aantal] ?? '', 10) || 0) + nieuweDatums.length
    const laatsteDatum = toonDatum(nieuweDatums[nieuweDatums.length - 1])
    plan.cellen.push({ rij: i, kolom: kol.aantal, waarde: String(aantal) }, { rij: i, kolom: kol.laatst, waarde: laatsteDatum })
    while (rij.length < kol.breedte) rij.push('')
    rij[kol.aantal] = String(aantal)
    rij[kol.laatst] = laatsteDatum
    plan.bijgewerkt++
  }
  return plan
}

/** Stap C (rekenen): indexen van bestaande rijen zonder "ja" waarvan "Laatst gezien" voorbij de bewaartermijn is. */
function teVerwijderenRijen(rijen: string[][], kol: Kolommen, now: number): number[] {
  const vandaagDagen = isoNaarDagen(vandaag(new Date(now)))
  const indexen: number[] = []
  rijen.forEach((rij, i) => {
    if (i === 0 || isJa(rij[kol.toegestaan])) return
    const laatst = leesDatum(rij[kol.laatst] ?? '')
    if (laatst && vandaagDagen - isoNaarDagen(laatst) > BEWAARTERMIJN_DAGEN) indexen.push(i)
  })
  // Van onder naar boven, zodat de indexen kloppen
  return indexen.sort((a, b) => b - a)
}

const foutTekst = (err: unknown) => (err instanceof Error ? err.message : 'onbekende fout')

/** Zet registraties in de sheet, schrijft de "ja"-lijst terug en ruimt oude rijen op. */
export async function syncToegang(now: number, deps: SyncDeps): Promise<SyncResultaat | null> {
  const resultaat: SyncResultaat = { nieuw: 0, bijgewerkt: 0, verwijderd: 0, toegestaan: 0 }
  let sheetId: number | null
  let rijen: string[][]
  try {
    sheetId = await deps.sheets.sheetId(TAB)
    if (sheetId === null) {
      console.error(`sync-toegang: tabblad "${TAB}" bestaat niet; maak het aan in de toegangs-sheet`)
      return null
    }
    rijen = await deps.sheets.lees(TAB)
    if (rijen.length === 0 || rijen[0].every((c) => !c.trim())) {
      await deps.sheets.schrijf(TAB, KOPREGEL.map((waarde, kolom) => ({ rij: 0, kolom, waarde })))
      rijen = [[...KOPREGEL]]
    }
  } catch (err) {
    // Bestaande lijst ongemoeid laten: nooit overschrijven door een fout
    console.error('sync-toegang: sheet lezen mislukt:', foutTekst(err))
    return null
  }

  const kol = zoekKolommen(rijen[0])
  if (!kol) {
    console.error(`sync-toegang: kopregel van "${TAB}" mist een van de kolommen ${VERPLICHTE_KOLOMMEN.join(', ')}`)
    return null
  }

  // Eerst alles in het geheugen uitrekenen
  let plan: Plan = { cellen: [], nieuweRijen: [], bijgewerkt: 0, keys: [] }
  let planGelukt = true
  try {
    const { perNetwerk, alleKeys } = await leesRegistraties(deps.netwerken)
    plan = maakPlan(perNetwerk, alleKeys, rijen, kol)
  } catch (err) {
    planGelukt = false
    console.error('sync-toegang: registraties lezen mislukt:', foutTekst(err))
  }
  const teVerwijderen = teVerwijderenRijen(rijen, kol, now)
  const netwerken = [...new Set(
    rijen.slice(1).filter((r) => isJa(r[kol.toegestaan])).map((r) => (r[kol.netwerk] ?? '').trim()).filter(Boolean),
  )]

  // Toepassen: (a) cellen bijwerken, (b) oude rijen verwijderen, (c) nieuwe rijen toevoegen, (d) sleutels opruimen
  let gelukt = planGelukt
  try {
    if (plan.cellen.length > 0) await deps.sheets.schrijf(TAB, plan.cellen)
    resultaat.bijgewerkt = plan.bijgewerkt
  } catch (err) {
    gelukt = false
    console.error('sync-toegang: cellen bijwerken mislukt:', foutTekst(err))
  }
  try {
    if (teVerwijderen.length > 0) await deps.sheets.verwijderRijen(sheetId, teVerwijderen)
    resultaat.verwijderd = teVerwijderen.length
  } catch (err) {
    console.error('sync-toegang: oude rijen verwijderen mislukt:', foutTekst(err))
  }
  // Na een mislukte (a) niet toevoegen: de sleutels blijven staan en de volgende run doet alles opnieuw
  if (gelukt) {
    try {
      if (plan.nieuweRijen.length > 0) await deps.sheets.voegToe(TAB, plan.nieuweRijen)
      resultaat.nieuw = plan.nieuweRijen.length
    } catch (err) {
      gelukt = false
      console.error('sync-toegang: rijen toevoegen mislukt:', foutTekst(err))
    }
  }
  if (gelukt) {
    try {
      // Ook onleesbare sleutels: die zijn waardeloos
      for (const key of plan.keys) await deps.netwerken.delete(key)
    } catch (err) {
      console.error('sync-toegang: sleutels opruimen mislukt:', foutTekst(err))
    }
  }

  try {
    await deps.toegang.setJSON(LIJST_KEY, { netwerken, bijgewerkt: now })
    resultaat.toegestaan = netwerken.length
  } catch (err) {
    console.error('sync-toegang: toegangslijst schrijven mislukt:', foutTekst(err))
  }

  console.log(
    `sync-toegang: ${resultaat.nieuw} nieuwe en ${resultaat.bijgewerkt} bijgewerkte netwerken, ` +
    `${resultaat.verwijderd} rijen verwijderd, ${resultaat.toegestaan} netwerken toegestaan`,
  )
  return resultaat
}

// ---- Echte Sheets-client ----

function kolomLetter(n: number): string {
  let s = ''
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

export function maakSheetsClient(spreadsheetId: string): SheetsClient {
  const basis = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`
  async function aanroep(pad: string, init: { method?: string; body?: unknown } = {}): Promise<Record<string, unknown>> {
    const token = await googleAccessToken(SCOPE)
    const response = await fetch(`${basis}${pad}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    // Alleen de status: de body van Google kan details bevatten
    if (!response.ok) throw new Error(`Google Sheets antwoordde met HTTP ${response.status}`)
    return (await response.json()) as Record<string, unknown>
  }
  const bereik = (tab: string, deel = '') => encodeURIComponent(`'${tab}'${deel}`)

  return {
    async sheetId(tab) {
      const data = await aanroep('?fields=sheets.properties')
      const sheets = (data.sheets ?? []) as { properties: { sheetId: number; title: string } }[]
      return sheets.find((s) => s.properties.title === tab)?.properties.sheetId ?? null
    },
    async lees(tab) {
      const data = await aanroep(`/values/${bereik(tab)}?valueRenderOption=UNFORMATTED_VALUE`)
      return ((data.values ?? []) as unknown[][]).map((rij) => rij.map((c) => String(c ?? '')))
    },
    async schrijf(tab, cellen) {
      await aanroep('/values:batchUpdate', {
        method: 'POST',
        body: {
          valueInputOption: 'RAW',
          data: cellen.map((c) => ({ range: `'${tab}'!${kolomLetter(c.kolom)}${c.rij + 1}`, values: [[c.waarde]] })),
        },
      })
    },
    async voegToe(tab, rijen) {
      await aanroep(`/values/${bereik(tab, '!A:A')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: { values: rijen },
      })
    },
    async verwijderRijen(sheetId, rijen) {
      await aanroep(':batchUpdate', {
        method: 'POST',
        body: {
          requests: rijen.map((rij) => ({
            deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rij, endIndex: rij + 1 } },
          })),
        },
      })
    },
  }
}

export default async (): Promise<Response> => {
  const sheetId = process.env.GOOGLE_TOEGANG_SHEET_ID
  if (!sheetId || !process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY) {
    console.error('sync-toegang: GOOGLE_TOEGANG_SHEET_ID of de service-account-env ontbreekt; niets gedaan')
    return new Response(JSON.stringify({ error: 'niet geconfigureerd' }), { status: 200 })
  }
  const resultaat = await syncToegang(Date.now(), {
    sheets: maakSheetsClient(sheetId),
    netwerken: getStore(NETWERKEN_STORE),
    toegang: getStore(TOEGANG_STORE),
  })
  return new Response(JSON.stringify(resultaat), { status: 200 })
}

export const config = { schedule: '*/10 * * * *' }
