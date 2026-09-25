/**
 * Het dagoverzicht als opgemaakte HTML-mail. Staat buiten netlify/functions/,
 * anders zou Netlify het als losse functie zien.
 *
 * Mailprogramma's (Outlook!) tonen alleen tabellen met inline-stijlen betrouwbaar,
 * en geen SVG: vandaar de PNG-logo's in /email/ en de ouderwetse opbouw.
 * Alle tekst van de gebruiker gaat door esc(): de mail bevat nooit HTML van buiten.
 */

export interface DagoverzichtItem {
  sentAt: string
  orderId: string | null
  name: string
  route: string
  colli: number
  colliOmschrijvingen: string[]
  spoed: boolean
}

export interface DagoverzichtInput {
  senderName: string
  items: DagoverzichtItem[]
}

const BLAUW = '#003883'
const BLAUW_LICHT = '#e8eef8'
const GROEN = '#1a5c2a'
const GROEN_LICHT = '#edf7ef'
const ORANJE = '#ff7b27'
const ORANJE_LICHT = '#fff3ec'
const GRIJS = '#6b7280'
const FONT = "font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;"

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const tz = { timeZone: 'Europe/Amsterdam' } as const
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { ...tz, hour: '2-digit', minute: '2-digit' })
const langeDatum = (d: Date) =>
  d.toLocaleDateString('nl-NL', { ...tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const korteDatum = (d: Date) => d.toLocaleDateString('nl-NL', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' })

export function dagoverzichtSubject(items: DagoverzichtItem[], now: Date): string {
  const n = items.length
  return `Dagoverzicht post ${korteDatum(now)} – ${n} ${n === 1 ? 'zending' : 'zendingen'}`
}

function tegel(waarde: number, label: string, kleur: string, achtergrond: string): string {
  return `<td width="33%" style="padding:0 6px;" valign="top">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${achtergrond};border-radius:10px;">
    <tr><td align="center" style="padding:14px 8px 4px;${FONT}font-size:28px;font-weight:bold;color:${kleur};">${waarde}</td></tr>
    <tr><td align="center" style="padding:0 8px 14px;${FONT}font-size:12px;color:${GRIJS};text-transform:uppercase;letter-spacing:.5px;">${label}</td></tr>
  </table>
</td>`
}

function badge(tekst: string, kleur: string, achtergrond: string): string {
  return `<span style="display:inline-block;${FONT}font-size:12px;font-weight:bold;color:${kleur};background:${achtergrond};border-radius:999px;padding:4px 10px;white-space:nowrap;">${tekst}</span>`
}

function zending(item: DagoverzichtItem): string {
  const omschrijvingen = item.colliOmschrijvingen.slice(0, item.colli).filter(Boolean)
  const details = [item.route, `${item.colli} ${item.colli === 1 ? 'collo' : 'colli'}`].filter(Boolean).map(esc).join(' &middot; ')
  const order = item.orderId
    ? badge(`Order ${esc(item.orderId)}`, GROEN, GROEN_LICHT)
    : badge('Geen ordernummer', '#b45309', '#fef3c7')
  const spoed = item.spoed ? `<div style="margin-top:6px;">${badge('SPOED', '#ffffff', ORANJE)}</div>` : ''
  return `<tr>
  <td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-left:4px solid ${item.spoed ? ORANJE : GROEN};border-radius:10px;margin-bottom:10px;">
      <tr>
        <td width="64" valign="top" style="padding:14px 0 14px 14px;${FONT}font-size:15px;font-weight:bold;color:${BLAUW};">${esc(tijd(item.sentAt))}</td>
        <td valign="top" style="padding:14px 10px;${FONT}">
          <div style="font-size:15px;font-weight:bold;color:#111827;">${esc(item.name)}</div>
          <div style="font-size:13px;color:${GRIJS};margin-top:3px;">${details}</div>
          ${omschrijvingen.length ? `<div style="font-size:13px;color:#374151;margin-top:6px;">${omschrijvingen.map(esc).join(' &middot; ')}</div>` : ''}
        </td>
        <td valign="top" align="right" style="padding:14px 14px 14px 0;">${order}${spoed}</td>
      </tr>
    </table>
  </td>
</tr>`
}

/** `assetBase`: waar /email/*.png staan, bijvoorbeeld https://post-aanmelden.netlify.app */
export function dagoverzichtHtml({ senderName, items }: DagoverzichtInput, now: Date, assetBase: string): string {
  const oudsteEerst = [...items].sort((a, b) => a.sentAt.localeCompare(b.sentAt))
  const colli = items.reduce((som, i) => som + i.colli, 0)
  const spoed = items.filter(i => i.spoed).length
  const zonderOrder = items.filter(i => !i.orderId).length
  const base = assetBase.replace(/\/$/, '')

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(dagoverzichtSubject(items, now))}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,56,131,.08);">

    <tr><td style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="left" valign="middle"><img src="${base}/email/miedema-logo.png" width="164" height="40" alt="Miedema Ophaaldienst" style="display:block;border:0;"></td>
        <td align="right" valign="middle"><img src="${base}/email/eurofins-agro.png" width="138" height="34" alt="Eurofins Agro" style="display:block;border:0;margin-left:auto;"></td>
      </tr></table>
    </td></tr>

    <tr><td style="background:${BLAUW};padding:26px 24px;${FONT}">
      <div style="font-size:24px;font-weight:bold;color:#ffffff;">Dagoverzicht post</div>
      <div style="font-size:14px;color:#c7d3ea;margin-top:6px;">${esc(langeDatum(now))}${senderName.trim() ? ` &middot; aangemeld door ${esc(senderName.trim())}` : ''}</div>
    </td></tr>
    <tr><td style="height:4px;background:#f5c800;line-height:4px;font-size:0;">&nbsp;</td></tr>

    <tr><td style="padding:22px 18px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${tegel(items.length, items.length === 1 ? 'zending' : 'zendingen', BLAUW, BLAUW_LICHT)}
        ${tegel(colli, 'colli', BLAUW, BLAUW_LICHT)}
        ${tegel(spoed, 'spoed', spoed ? ORANJE : GRIJS, spoed ? ORANJE_LICHT : '#f3f4f6')}
      </tr></table>
    </td></tr>

    <tr><td style="padding:18px 24px 10px;${FONT}font-size:13px;font-weight:bold;color:${GRIJS};text-transform:uppercase;letter-spacing:.6px;">Verzonden zendingen</td></tr>
    ${oudsteEerst.map(zending).join('\n')}

    ${zonderOrder ? `<tr><td style="padding:4px 24px 0;${FONT}font-size:13px;color:#b45309;">Bij ${zonderOrder} ${zonderOrder === 1 ? 'zending is' : 'zendingen is'} de order in Mendrix niet aangemaakt; die labels hebben geen QR-code.</td></tr>` : ''}

    <tr><td style="padding:22px 24px 26px;${FONT}font-size:14px;color:#374151;line-height:1.6;">
      Met vriendelijke groet,<br><strong>Miedema Ophaaldienst B.V.</strong>
    </td></tr>

    <tr><td style="background:#f9fafb;border-top:1px solid #eef0f4;padding:16px 24px;${FONT}font-size:12px;color:#9ca3af;line-height:1.6;">
      Dit overzicht is verstuurd vanuit de Post aanmelden app. Reageren op deze mail heeft geen zin; hij wordt niet gelezen.<br>
      Vragen? Bel of WhatsApp <strong style="color:${GRIJS};">085 369 5003</strong>.
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`
}
