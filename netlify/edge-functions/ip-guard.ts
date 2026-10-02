import { getStore } from '@netlify/blobs'
import { FILTER_MODE, ALLOWED_IPS } from '../allowed-ips.ts'
import { CLIENT_IP_HEADER } from '../client-ip.ts'
import { isBeschermdPad } from '../beschermde-paden.ts'
import { netwerkVan, staatOpLijst } from '../ip-match.ts'
import { LIJST_KEY, NETWERKEN_STORE, TOEGANG_STORE, netwerkKey, vandaag, type ToegangsLijst } from '../toegang-opslag.ts'

const CACHE_MS = 60_000

let lijstCache: string[] | null = null
let volgendePoging = 0
let lopend: Promise<string[]> | null = null
let waarschuwingGegeven = false
// Per isolate: elk netwerk hoogstens één keer per dag wegschrijven
const geregistreerd = new Set<string>()

export default async function handler(
  request: Request,
  context: { ip: string; next: (request?: Request) => Promise<Response>; waitUntil?: (promise: Promise<unknown>) => void },
) {
  const clientIp = context.ip ?? 'onbekend'

  const url = new URL(request.url)

  // De logo's in de dagoverzicht-mail: Gmail en Outlook halen ze op vanaf hun
  // eigen servers, niet vanaf de werkplek. Alleen die paar plaatjes, verder niets.
  if (url.pathname.startsWith('/email/') && url.pathname.endsWith('.png')) return context.next()

  if (FILTER_MODE !== 'uit' && isBeschermdPad(url.pathname)) {
    registreer(clientIp, context.waitUntil)
    if (FILTER_MODE === 'aan' && !(await heeftToegang(clientIp))) {
      return new Response(JSON.stringify({ error: 'geen-toegang', netwerk: netwerkVan(clientIp) }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  return context.next(withClientIpHeader(request, url, clientIp))
}

/**
 * Functies achter deze edge function zien als context.ip het adres van de edge,
 * niet dat van de gebruiker. Daarom geven we het echte IP als header door;
 * een meegestuurde waarde van de browser wordt overschreven.
 */
function withClientIpHeader(request: Request, url: URL, clientIp: string): Request | undefined {
  if (!url.pathname.startsWith('/.netlify/functions/')) return undefined
  const headers = new Headers(request.headers)
  headers.set(CLIENT_IP_HEADER, clientIp)
  return new Request(request, { headers })
}

/** Zet het netwerk (eenmaal per dag) in de blob-store, zonder de request te vertragen. */
function registreer(ip: string, waitUntil?: (promise: Promise<unknown>) => void): void {
  if (ip === 'onbekend') return
  const netwerk = netwerkVan(ip)
  const datum = vandaag()
  const sleutel = netwerkKey(datum, netwerk)
  if (geregistreerd.has(sleutel)) return
  geregistreerd.add(sleutel)

  const schrijf = (async () => {
    try {
      await getStore(NETWERKEN_STORE).setJSON(sleutel, { netwerk, datum })
    } catch (error) {
      // Mislukt: bij de volgende request opnieuw proberen
      geregistreerd.delete(sleutel)
      console.warn('ip-guard: netwerk registreren mislukt', error)
    }
  })()
  if (waitUntil) waitUntil(schrijf)
}

async function heeftToegang(ip: string): Promise<boolean> {
  const lijst = await leesToegangslijst()
  return staatOpLijst(ip, [...ALLOWED_IPS, ...lijst])
}

/**
 * Toegestane netwerken uit de blob. Hoogstens één leespoging per 60 s, ook na een
 * fout. Faalt het lezen, dan blijft de laatst bekende lijst gelden (stale-if-error);
 * is die er niet, dan geldt alleen het vangnet ALLOWED_IPS.
 */
function leesToegangslijst(): Promise<string[]> {
  // Gelijktijdige requests wachten op dezelfde leesactie
  if (lopend) return lopend
  if (Date.now() < volgendePoging) return Promise.resolve(lijstCache ?? [])
  lopend = laadToegangslijst().finally(() => { lopend = null })
  return lopend
}

async function laadToegangslijst(): Promise<string[]> {
  volgendePoging = Date.now() + CACHE_MS
  try {
    const lijst = (await getStore(TOEGANG_STORE).get(LIJST_KEY, { type: 'json' })) as ToegangsLijst | null
    if (!lijst || !Array.isArray(lijst.netwerken)) throw new Error('geen toegangslijst')
    lijstCache = lijst.netwerken
  } catch (error) {
    if (!waarschuwingGegeven) {
      waarschuwingGegeven = true
      console.warn('ip-guard: toegangslijst niet beschikbaar, laatst bekende lijst of ALLOWED_IPS geldt', error)
    }
  }
  return lijstCache ?? []
}
