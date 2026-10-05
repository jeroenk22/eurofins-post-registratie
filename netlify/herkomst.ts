/** Wie zit achter een netwerk? RDAP-lookup, vertaald naar een label voor de beheerder van de sheet. */

const TIMEOUT_MS = 5000

interface RdapEntity { roles?: string[]; vcardArray?: unknown[]; entities?: RdapEntity[] }
interface RdapAntwoord { name?: string; country?: string; entities?: RdapEntity[] }

const CLOUD_PARTIJEN: { zoek: RegExp; naam: string }[] = [
  { zoek: /google/i, naam: 'Google' },
  { zoek: /microsoft/i, naam: 'Microsoft' },
  { zoek: /digitalocean/i, naam: 'DigitalOcean' },
  { zoek: /\bovh/i, naam: 'OVH' },
  { zoek: /hetzner/i, naam: 'Hetzner' },
  { zoek: /cloudflare/i, naam: 'Cloudflare' },
]

function fnVan(entity: RdapEntity): string | null {
  const velden = Array.isArray(entity.vcardArray?.[1]) ? (entity.vcardArray[1] as unknown[][]) : []
  const fn = velden.find((v) => v[0] === 'fn')?.[3]
  return typeof fn === 'string' && fn.trim() ? fn.trim() : null
}

/** Handles zoals "KPN-MNT" of "ZSCALER-RIPE-MNT" zijn geen leesbare organisatienaam. */
const isHandle = (fn: string) => /-mnt$/i.test(fn) || (/^[A-Z0-9-]+$/.test(fn) && !fn.includes(' '))

/** Alle fn-waarden, de registrant (de eigenaar) eerst. */
function organisaties(entities: RdapEntity[] | undefined): string[] {
  const registrant: string[] = []
  const rest: string[] = []
  const loop = (lijst: RdapEntity[] | undefined, diep: boolean) => {
    for (const e of lijst ?? []) {
      const fn = fnVan(e)
      if (fn) (!diep && e.roles?.includes('registrant') ? registrant : rest).push(fn)
      loop(e.entities, true)
    }
  }
  loop(entities, false)
  return [...registrant, ...rest]
}

function vertaal(data: RdapAntwoord): string | null {
  const orgs = organisaties(data.entities)
  const naam = data.name?.trim() || null
  const alles = [...orgs, naam ?? ''].join(' | ')
  if (/amazon/i.test(alles)) return 'Amazon-server (VS): robot, geen werkplek. Geen toegang geven.'
  const cloud = CLOUD_PARTIJEN.find((c) => c.zoek.test(alles))
  if (cloud) return `${cloud.naam}-server: geen werkplek. Geen toegang geven.`
  if (/zscaler/i.test(alles)) return 'Zscaler (beveiligd bedrijfsnetwerk, o.a. Eurofins-laptops; adres wordt gedeeld en wisselt)'
  const org = orgs.find((o) => !isHandle(o)) ?? naam
  if (!org) return null
  const land = data.country?.trim().toUpperCase()
  return land ? `${org} (${land})` : org
}

/** Geeft een leesbaar label, of null bij een fout of timeout (dan probeert de volgende run het opnieuw). */
export async function zoekHerkomst(netwerk: string, fetchFn: (url: string, init?: RequestInit) => Promise<Response> = fetch): Promise<string | null> {
  const adres = netwerk.trim().replace(/\/\d+$/, '')
  if (!/^[0-9a-f:.]+$/i.test(adres)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetchFn(`https://rdap.arin.net/registry/ip/${adres}`, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'application/rdap+json' },
    })
    if (!response.ok) return null
    return vertaal((await response.json()) as RdapAntwoord)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
