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
  // Brother QL — DK-serie
  { id: 'brother_dk11201', name: 'Brother DK-11201 – adres (29×90mm)',       widthMm: 29, heightMm: 90  },
  { id: 'brother_dk11209', name: 'Brother DK-11209 – klein adres (29×62mm)', widthMm: 29, heightMm: 62  },
  { id: 'brother_dk11208', name: 'Brother DK-11208 – groot adres (38×90mm)', widthMm: 38, heightMm: 90  },
  { id: 'brother_dk11202', name: 'Brother DK-11202 – verzending (62×100mm)', widthMm: 62, heightMm: 100 },
]

const FORMAT_STORAGE_KEY = 'label_format'
const DEFAULT_FORMAT_ID  = 'dymo_99010'

export function getSelectedFormat(): LabelFormat {
  const stored = localStorage.getItem(FORMAT_STORAGE_KEY)
  return LABEL_FORMATS.find(f => f.id === stored) ?? LABEL_FORMATS.find(f => f.id === DEFAULT_FORMAT_ID)!
}

export function setSelectedFormat(id: string): void {
  localStorage.setItem(FORMAT_STORAGE_KEY, id)
}

export interface PrintEntry {
  name: string
  schapnummer: string  // al geformatteerd, bijv. "Schap 3" of "Overig: koeling"
  colli: number
}

export function printLabels(entries: PrintEntry[], format: LabelFormat): void {
  if (entries.length === 0) return

  // Flatten to individual labels
  const labels: Array<{ name: string; schapnummer: string; index: number; total: number }> = []
  for (const entry of entries) {
    for (let i = 1; i <= entry.colli; i++) {
      labels.push({ name: entry.name, schapnummer: entry.schapnummer, index: i, total: entry.colli })
    }
  }

  const { widthMm, heightMm } = format
  const isPortrait = heightMm > widthMm

  // Font sizes based on label height
  let fontName: string
  let fontSschap: string
  let fontColli: string
  if (heightMm <= 28) {
    fontName  = '9pt'
    fontSschap = '7pt'
    fontColli  = '8pt'
  } else if (heightMm <= 40) {
    fontName  = '11pt'
    fontSschap = '8pt'
    fontColli  = '10pt'
  } else {
    fontName  = '14pt'
    fontSschap = '10pt'
    fontColli  = '12pt'
  }

  const labelHtml = labels.map((l, i) => {
    const isLast = i === labels.length - 1
    return `<div class="label" style="break-after:${isLast ? 'avoid' : 'page'}">
  <div class="name">${escapeHtml(l.name)}</div>
  ${l.schapnummer ? `<div class="schap">Schap: ${escapeHtml(l.schapnummer)}</div>` : ''}
  <div class="colli">${l.index} / ${l.total} colli</div>
</div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {
  size: ${widthMm}mm ${heightMm}mm;
  margin: 2mm;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, Helvetica, sans-serif;
  width: ${widthMm - 4}mm;
}
.label {
  width: 100%;
  height: ${heightMm - 4}mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${isPortrait ? '3mm' : '1mm'};
  overflow: hidden;
}
.name {
  font-size: ${fontName};
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.schap {
  font-size: ${fontSschap};
  color: #444;
}
.colli {
  font-size: ${fontColli};
  font-weight: bold;
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
  return encodeURIComponent(JSON.stringify(entries))
}

export function decodePrintData(encoded: string): PrintEntry[] | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded))
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
