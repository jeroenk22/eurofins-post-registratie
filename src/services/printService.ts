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
  { id: 'dymo_s0904980',   name: 'DYMO 99014 – verzending (54×101mm)',  widthMm: 54,  heightMm: 101 },
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
}

export function printLabels(entries: PrintEntry[], format: LabelFormat): void {
  if (entries.length === 0) return

  // Flatten to individual labels
  const labels: Array<{ name: string; adres: string; postcode: string; plaats: string; land: string; route: string; index: number; total: number; spoed: boolean; omschrijving: string }> = []
  for (const entry of entries) {
    // Strip the "(plaats)" suffix added by autocomplete value formatting, but only if it matches exactly
    const suffix = entry.plaats ? ` (${entry.plaats})` : ''
    const cleanName = suffix && entry.name.endsWith(suffix)
      ? entry.name.slice(0, -suffix.length)
      : entry.name
    for (let i = 1; i <= entry.colli; i++) {
      labels.push({ name: cleanName, adres: entry.adres, postcode: entry.postcode, plaats: entry.plaats, land: entry.land, route: entry.route, index: i, total: entry.colli, spoed: entry.spoed, omschrijving: entry.colliOmschrijvingen[i - 1] ?? '' })
    }
  }

  const { widthMm, heightMm } = format
  const shortMm = Math.min(widthMm, heightMm)

  // Font sizes based on the short dimension of the label
  let fontName: string
  let fontAddr: string
  let fontRoute: string
  let fontColli: string
  let fontSpoed: string
  if (shortMm < 30) {
    fontName  = '9pt'
    fontAddr  = '7pt'
    fontRoute = '9pt'
    fontColli = '9pt'
    fontSpoed = '8pt'
  } else if (shortMm <= 40) {
    fontName  = '15pt'
    fontAddr  = '11pt'
    fontRoute = '13pt'
    fontColli = '14pt'
    fontSpoed = '11pt'
  } else {
    fontName  = '16pt'
    fontAddr  = '12pt'
    fontRoute = '13pt'
    fontColli = '14pt'
    fontSpoed = '12pt'
  }

  const labelHtml = labels.map((l, i) => {
    const isLast = i === labels.length - 1
    const postcodeplaats = [l.postcode, l.plaats].filter(Boolean).join('  ')
    return `<div class="label" style="break-after:${isLast ? 'avoid' : 'page'}">
  <div class="content">
    <div class="name">${escapeHtml(l.name)}</div>
    ${l.adres ? `<div class="addr">${escapeHtml(l.adres)}</div>` : ''}
    ${postcodeplaats ? `<div class="addr">${escapeHtml(postcodeplaats)}</div>` : ''}
    ${l.land ? `<div class="addr">${escapeHtml(l.land)}</div>` : ''}
    ${l.omschrijving ? `<div class="omschrijving">${escapeHtml(l.omschrijving)}</div>` : ''}
  </div>
  <div class="bottom">
    <div class="bottom-left">
      ${l.spoed ? `<div class="spoed">SPOED</div>` : ''}
      ${l.route ? `<div class="route">${escapeHtml(l.route)}</div>` : ''}
    </div>
    <div class="colli">${l.index}/${l.total}</div>
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
  padding: 3mm 4mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 1mm;
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
.bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.bottom-left {
  display: flex;
  align-items: center;
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
  padding: 1mm 2.5mm;
  border-radius: 1mm;
  letter-spacing: 0.5pt;
}
.colli {
  font-size: ${fontColli};
  font-weight: bold;
}
.omschrijving {
  font-size: ${fontAddr};
  font-style: italic;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1mm;
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
