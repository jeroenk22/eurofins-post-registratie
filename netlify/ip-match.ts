/**
 * Netwerken herkennen en vergelijken: IPv4 per adres, IPv6 per /64-prefix
 * (een thuis- of kantoornetwerk krijgt één /64; het apparaat wisselt binnen
 * die prefix steeds van adres).
 */

type Adres = { v4: number[] } | { v6: number[] }

function parseIpv4(tekst: string): number[] | null {
  const delen = tekst.split('.')
  if (delen.length !== 4) return null
  const octetten = delen.map((d) => (/^\d{1,3}$/.test(d) ? Number(d) : NaN))
  return octetten.every((o) => o <= 255) ? octetten : null
}

function parseIpv6(tekst: string): number[] | null {
  const zonder = tekst.split('%')[0]
  if (!zonder.includes(':')) return null
  let tail: number[] = []
  let invoer = zonder
  // Ingebed IPv4-adres achteraan (::ffff:1.2.3.4) wordt twee hextets
  const laatste = invoer.slice(invoer.lastIndexOf(':') + 1)
  if (laatste.includes('.')) {
    const v4 = parseIpv4(laatste)
    if (!v4) return null
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]]
    invoer = invoer.slice(0, invoer.lastIndexOf(':') + 1) + '0:0'
  }
  const stukken = invoer.split('::')
  if (stukken.length > 2) return null
  const naarHextets = (s: string) => (s === '' ? [] : s.split(':'))
  const kop = naarHextets(stukken[0])
  const staart = stukken.length === 2 ? naarHextets(stukken[1]) : []
  const alle = [...kop, ...staart]
  if (!alle.every((h) => /^[0-9a-fA-F]{1,4}$/.test(h))) return null
  let groepen: string[]
  if (stukken.length === 2) {
    if (alle.length > 7) return null
    groepen = [...kop, ...Array<string>(8 - alle.length).fill('0'), ...staart]
  } else {
    if (alle.length !== 8) return null
    groepen = alle
  }
  const getallen = groepen.map((h) => parseInt(h, 16))
  if (tail.length) {
    getallen[6] = tail[0]
    getallen[7] = tail[1]
  }
  return getallen
}

function parseAdres(ip: string): Adres | null {
  const v4 = parseIpv4(ip)
  if (v4) return { v4 }
  const v6 = parseIpv6(ip)
  if (!v6) return null
  const gemapt = v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff
  if (gemapt) return { v4: [v6[6] >> 8, v6[6] & 255, v6[7] >> 8, v6[7] & 255] }
  return { v6 }
}

/** Gecomprimeerde notatie: de langste reeks nullen (minstens 2) wordt "::". */
function comprimeer(groepen: number[]): string {
  let besteStart = -1
  let besteLengte = 0
  for (let i = 0; i < groepen.length; ) {
    if (groepen[i] !== 0) { i++; continue }
    let j = i
    while (j < groepen.length && groepen[j] === 0) j++
    if (j - i > besteLengte) { besteStart = i; besteLengte = j - i }
    i = j
  }
  const hex = groepen.map((g) => g.toString(16))
  if (besteLengte < 2) return hex.join(':')
  return `${hex.slice(0, besteStart).join(':')}::${hex.slice(besteStart + besteLengte).join(':')}`
}

/** Het netwerk waartoe een IP behoort: IPv4-adres of IPv6-/64-prefix. */
export function netwerkVan(ip: string): string {
  const schoon = ip.trim()
  const adres = parseAdres(schoon)
  if (!adres) return schoon
  if ('v4' in adres) return adres.v4.join('.')
  return `${comprimeer([...adres.v6.slice(0, 4), 0, 0, 0, 0])}/64`
}

function zelfdePrefix(a: number[], b: number[], bits: number): boolean {
  const eenheid = a.length === 4 ? 8 : 16
  for (let i = 0; i < a.length; i++) {
    const over = Math.min(Math.max(bits - i * eenheid, 0), eenheid)
    if (over === 0) break
    const masker = ((1 << over) - 1) << (eenheid - over)
    if ((a[i] & masker) !== (b[i] & masker)) return false
  }
  return true
}

function pastBijRegel(adres: Adres, regel: string): boolean {
  const [basis, lengteTekst, ...rest] = regel.split('/')
  if (rest.length) return false
  const doel = parseAdres(basis.trim())
  if (!doel) return false
  const heeftLengte = lengteTekst !== undefined
  if (heeftLengte && !/^\d{1,3}$/.test(lengteTekst.trim())) return false
  const lengte = heeftLengte ? Number(lengteTekst) : undefined

  if ('v4' in doel) {
    if (!('v4' in adres)) return false
    if (lengte === undefined) return zelfdePrefix(adres.v4, doel.v4, 32)
    return lengte <= 32 && zelfdePrefix(adres.v4, doel.v4, lengte)
  }
  if (!('v6' in adres)) return false
  // Een los IPv6-adres geldt voor zijn hele /64
  const bits = lengte ?? 64
  return bits <= 128 && zelfdePrefix(adres.v6, doel.v6, bits)
}

/** Staat dit IP op de lijst (IPv4, IPv4-CIDR, IPv6-/64-prefix of IPv6-adres)? */
export function staatOpLijst(ip: string, lijst: string[]): boolean {
  const adres = parseAdres(ip.trim())
  if (!adres) return false
  return lijst.some((regel) => {
    const schoon = regel.trim()
    return schoon !== '' && pastBijRegel(adres, schoon)
  })
}
