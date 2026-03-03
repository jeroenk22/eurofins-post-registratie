import { FILTER_ENABLED, ALLOWED_IPS } from '../allowed-ips.ts'

export default async function handler(
  request: Request,
  context: { ip: string; next: () => Promise<Response> },
) {
  const clientIp = context.ip ?? 'onbekend'

  // Tijdelijk diagnostisch eindpunt: /debug-ip toont het gedetecteerde IP
  const url = new URL(request.url)
  if (url.pathname === '/debug-ip') {
    return new Response(
      JSON.stringify({
        ip: clientIp,
        filterEnabled: FILTER_ENABLED,
        allowed: ALLOWED_IPS.includes(clientIp),
      }),
      { headers: { 'content-type': 'application/json' } },
    )
  }

  if (!FILTER_ENABLED) return context.next()

  if (ALLOWED_IPS.includes(clientIp)) return context.next()

  return new Response(blockedHtml(clientIp), {
    status: 403,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function blockedHtml(ip: string): string {
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Geen toegang</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f9fafb;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 2rem 2.5rem;
            max-width: 360px; text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    h1 { color: #003883; font-size: 1.25rem; margin: 0 0 .75rem; }
    p  { color: #6b7280; font-size: .9rem; line-height: 1.6; margin: 0; }
    .ip { font-family: monospace; font-size: .8rem; color: #9ca3af;
          margin-top: .75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Toegang geweigerd</h1>
    <p>Deze applicatie is alleen toegankelijk via een goedgekeurd netwerk.<br>
       Verbind met het juiste wifi-netwerk en probeer het opnieuw.</p>
    <p class="ip">Gedetecteerd IP: ${ip}</p>
  </div>
</body>
</html>`
}
