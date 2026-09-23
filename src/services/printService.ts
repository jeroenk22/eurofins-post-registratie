import QRCode from 'qrcode'
import { MESTKLANT_SHORT_BY_LABEL } from '../mestklantOptions'

export interface LabelFormat {
  id: string
  name: string
  widthMm: number
  heightMm: number
}

export const LABEL_FORMATS: LabelFormat[] = [
  // DYMO LabelWriter
  { id: 'dymo_99010',      name: 'DYMO 99010 – adres (89×28mm)',        widthMm: 89,  heightMm: 28  },
  { id: 'dymo_99012',      name: 'DYMO 99012 – groot adres (89×36mm)',  widthMm: 89,  heightMm: 36  },
  { id: 'dymo_11354',      name: 'DYMO 11354 – multipurpose (57×32mm)', widthMm: 57,  heightMm: 32  },
  { id: 'dymo_11352',      name: 'DYMO 11352 – klein (54×25mm)',         widthMm: 54,  heightMm: 25  },
  // 99014: rol van 54mm breed, liggend bedrukt — net als de andere rolformaten
  { id: 'dymo_s0904980',   name: 'DYMO 99014 – verzending (101×54mm)',  widthMm: 101, heightMm: 54  },
  // Brother QL — DK-serie (landscape: rol is de korte kant, lengte is de brede kant)
  { id: 'brother_dk11201', name: 'Brother DK-11201 – adres (29×90mm)',       widthMm: 90, heightMm: 29  },
  { id: 'brother_dk11209', name: 'Brother DK-11209 – klein adres (29×62mm)', widthMm: 62, heightMm: 29  },
  { id: 'brother_dk11208', name: 'Brother DK-11208 – groot adres (38×90mm)', widthMm: 90, heightMm: 38  },
  { id: 'brother_dk11202', name: 'Brother DK-11202 – verzending (62×100mm)', widthMm: 100, heightMm: 62 },
]

const FORMAT_STORAGE_KEY = 'label_format'
const DEFAULT_FORMAT_ID  = 'brother_dk11208'

export function getSelectedFormat(): LabelFormat {
  const stored = localStorage.getItem(FORMAT_STORAGE_KEY)
  return LABEL_FORMATS.find(f => f.id === stored) ?? LABEL_FORMATS.find(f => f.id === DEFAULT_FORMAT_ID)!
}

export function setSelectedFormat(id: string): void {
  localStorage.setItem(FORMAT_STORAGE_KEY, id)
}

export interface PrintEntry {
  name: string
  adres: string
  postcode: string
  plaats: string
  route: string  // al geformatteerd, bijv. "Route 6" of "Overig: koeling"
  colli: number
  colliOmschrijvingen: string[]
  spoed: boolean
  land: string
  orderedAt?: string  // ISO-tijdstip waarop de order is aangemaakt (moment van versturen)
  orderId?: string    // Mendrix order-ID; komt als QR-code op het label
}

/**
 * Tekent een QR-code als SVG zonder witrand — de witruimte eromheen komt van
 * de etiketmarges. Synchroon, zodat het printvenster direct binnen de klik
 * geopend kan worden (anders grijpt de popup-blocker in).
 */
export function qrSvg(text: string): string {
  // Hoogste foutcorrectie: een kort ordernummer past daarmee nog steeds in de
  // kleinste QR-versie (21×21), en een vlek of kras op het etiket kan geen kwaad.
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const n = modules.size
  let d = ''
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`
    }
  }
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path d="${d}"/></svg>`
}

/** Formatteert een ISO-tijdstip als "dd-mm-jjjj uu:mm" in Nederlandse tijd. */
export function formatOrderDateTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const [day, month, year, hour, minute] = ['day', 'month', 'year', 'hour', 'minute'].map(get)
  if (!day || !month || !year || !hour || !minute) return ''
  return `${day}-${month}-${year} ${hour}:${minute}`
}

export function printLabels(entries: PrintEntry[], format: LabelFormat): void {
  if (entries.length === 0) return

  const { widthMm, heightMm } = format
  const shortMm = Math.min(widthMm, heightMm)
  // Gebruik het korte label voor formaten kleiner dan het standaard (brother_dk11208 = 38mm)
  const useShortLabel = shortMm < 38

  // Flatten to individual labels
  const labels: Array<{ name: string; adres: string; postcode: string; plaats: string; land: string; route: string; index: number; total: number; spoed: boolean; omschrijving: string; datum: string; orderId: string; qr: string }> = []
  for (const entry of entries) {
    // Strip the "(plaats)" suffix added by autocomplete value formatting, but only if it matches exactly
    const suffix = entry.plaats ? ` (${entry.plaats})` : ''
    const cleanName = suffix && entry.name.endsWith(suffix)
      ? entry.name.slice(0, -suffix.length)
      : entry.name
    const datum = formatOrderDateTime(entry.orderedAt)
    const orderId = entry.orderId?.trim() ?? ''
    const qr = orderId ? qrSvg(orderId) : ''
    for (let i = 1; i <= entry.colli; i++) {
      const rawOmschrijving = entry.colliOmschrijvingen[i - 1] ?? ''
      const omschrijving = useShortLabel
        ? (MESTKLANT_SHORT_BY_LABEL[rawOmschrijving] ?? rawOmschrijving)
        : rawOmschrijving
      labels.push({ name: cleanName, adres: entry.adres, postcode: entry.postcode, plaats: entry.plaats, land: entry.land, route: entry.route, index: i, total: entry.colli, spoed: entry.spoed, omschrijving, datum, orderId, qr })
    }
  }

  // Font sizes based on the short dimension of the label
  let fontName: string
  let fontAddr: string
  let fontRoute: string
  let fontColli: string
  let fontSpoed: string
  let fontDatum: string
  if (shortMm < 30) {
    fontName  = '9pt'
    fontAddr  = '7pt'
    fontRoute = '9pt'
    fontColli = '9pt'
    fontSpoed = '8pt'
    fontDatum = '5.5pt'
  } else if (shortMm < 34) {
    // Tussenformaat (o.a. DYMO 11354, 57×32mm): te klein voor het middelgrote
    // lettertype — daarmee liep de inhoud over de onderrand.
    fontName  = '12pt'
    fontAddr  = '9pt'
    fontRoute = '11pt'
    fontColli = '11pt'
    fontSpoed = '9pt'
    fontDatum = '6pt'
  } else if (shortMm <= 40) {
    fontName  = '15pt'
    fontAddr  = '11pt'
    fontRoute = '13pt'
    fontColli = '14pt'
    fontSpoed = '11pt'
    fontDatum = '6.5pt'
  } else {
    fontName  = '16pt'
    fontAddr  = '12pt'
    fontRoute = '13pt'
    fontColli = '14pt'
    fontSpoed = '12pt'
    fontDatum = '7.5pt'
  }

  // Op de kleinere etiketten is de hoogte krap: compactere marges maken ruimte
  // vrij voor de datumregel zonder dat de bovenste regels wegvallen. Ook DYMO
  // 99012 (36mm) valt hieronder: die krijgt de letters van 38mm, en liep met de
  // ruime marges tot op de onderrand.
  const tight     = shortMm < 37
  // Rondom dezelfde witrand. Niet onder de 2mm: links/rechts is de doorvoerrichting
  // van de rol, en daar kan de printer het etiket iets verschoven bedrukken.
  const pad       = tight ? '2mm'   : '3mm'
  const gapContent = tight ? '0.5mm' : '1mm'
  const gapDatum  = tight ? '0.3mm' : '0.8mm'
  // Het SPOED-blok is het hoogste in de onderste regel; op de kleinste formaten
  // (o.a. DYMO 11352, 54×25) liep de datumregel daardoor over de ondermarge.
  const spoedPadY = shortMm < 30 ? '0.5mm' : '1mm'

  // QR-code met het Mendrix order-ID, rechts naast de onderste regel en de datumregel.
  // Op de smalle formaten (o.a. 57×32) botste "Route 6" anders tegen "1/1"; onder
  // de 30mm is de onderste regel zo laag dat een grotere code het label oprekt.
  const smallQr = shortMm < 34
  const qrSize = shortMm < 30 ? '6.5mm' : smallQr ? '7mm' : '9mm'
  const gapQr  = smallQr ? '1.5mm' : '2mm'

  const labelHtml = labels.map((l, i) => {
    const isLast = i === labels.length - 1
    const postcodeplaats = [l.postcode, l.plaats].filter(Boolean).join('  ')
    const datumRegel = [l.orderId && `Order ${l.orderId}`, l.datum].filter(Boolean).join(' · ')
    return `<div class="label" style="break-after:${isLast ? 'avoid' : 'page'}">
  <div class="content">
    <div class="name">${escapeHtml(l.name)}</div>
    ${l.adres ? `<div class="addr">${escapeHtml(l.adres)}</div>` : ''}
    ${postcodeplaats ? `<div class="addr">${escapeHtml(postcodeplaats)}</div>` : ''}
    ${(l.land || l.omschrijving) ? `<div class="land-row"><span class="addr">${escapeHtml(l.land)}</span>${l.omschrijving ? `<span class="omschrijving">${escapeHtml(l.omschrijving)}</span>` : ''}</div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-main">
      <div class="bottom">
        <div class="bottom-left">
          ${l.spoed ? `<div class="spoed">SPOED</div>` : ''}
          ${l.route ? `<div class="route">${escapeHtml(l.route)}</div>` : ''}
        </div>
        <div class="colli">${l.index}/${l.total}</div>
      </div>
      ${datumRegel ? `<div class="datum">${escapeHtml(datumRegel)}</div>` : ''}
    </div>
    ${l.qr}
  </div>
</div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {
  size: ${widthMm}mm ${heightMm}mm;
  margin: 0;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  width: ${widthMm}mm;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.label {
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  padding: ${pad};
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}
.content {
  display: flex;
  flex-direction: column;
  gap: ${gapContent};
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 3mm;
  margin-bottom: 1mm;
}
.name {
  font-size: ${fontName};
  font-weight: bold;
  /* De regelhoogte laat wit boven de hoofdletters; zonder deze correctie oogt
     de bovenrand ruim 1mm breder dan de andere randen */
  margin-top: -0.2em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.route {
  font-size: ${fontRoute};
  font-weight: bold;
  white-space: nowrap;
  flex-shrink: 0;
}
.addr {
  font-size: ${fontAddr};
  color: #333;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.footer {
  display: flex;
  align-items: flex-end;
  gap: ${gapQr};
}
.footer-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.qr {
  display: block;
  width: ${qrSize};
  height: ${qrSize};
  flex-shrink: 0;
  align-self: flex-end;
}
/* SPOED, route en colli op één grondlijn, zodat "1/1" niet lager staat dan "Route 6" */
.bottom {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.bottom-left {
  display: flex;
  align-items: baseline;
  gap: 2mm;
}
.route {
  font-size: ${fontRoute};
  font-weight: bold;
  white-space: nowrap;
}
.spoed {
  font-size: ${fontSpoed};
  font-weight: bold;
  color: #fff;
  background: red;
  padding: ${spoedPadY} 2.5mm;
  border-radius: 1mm;
  letter-spacing: 0.5pt;
}
.land-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 2mm;
}
.colli {
  font-size: ${fontColli};
  font-weight: bold;
}
.datum {
  font-size: ${fontDatum};
  color: #555;
  line-height: 1.1;
  text-align: left;
  white-space: nowrap;
  margin-top: ${gapDatum};
  /* De ruimte onder de grondlijn (voor letters als g en p) valt buiten de regel,
     zodat de cijfers precies op de onderkant van de QR-code staan */
  margin-bottom: -0.2em;
  flex-shrink: 0;
}
.omschrijving {
  font-size: ${fontAddr};
  font-style: italic;
  font-weight: bold;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  min-width: 0;
  flex-shrink: 1;
}
</style>
</head>
<body>
${labelHtml}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
  win.close()
}

// --- URL encoding voor print-links ---

export function encodePrintData(entries: PrintEntry[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(entries))
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePrintData(encoded: string): PrintEntry[] | null {
  try {
    // Ondersteun zowel base64url (nieuw) als legacy encodeURIComponent (oud)
    let json: string
    if (encoded.startsWith('%') || encoded.startsWith('[') || encoded.startsWith('{')) {
      json = decodeURIComponent(encoded)
    } else {
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      json = new TextDecoder().decode(bytes)
    }
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return null
    return parsed as PrintEntry[]
  } catch {
    return null
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
