import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { isIP } from 'node:net';
import { CLIENT_IP_HEADER } from '../client-ip';

/** Zelfde vorm als newSubmissionId() in de app: 16 tekens base64url. */
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export default async (request: Request, context?: Context): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const targetUrl = process.env.NETLIFY_WEBHOOK_URL;
  const secret = process.env.NETLIFY_WEBHOOK_SECRET;

  if (!targetUrl || !secret) {
    console.error('forward-webhook: NETLIFY_WEBHOOK_URL of NETLIFY_WEBHOOK_SECRET niet ingesteld');
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500 });
  }

  const body = withClientIp(await request.text(), resolveClientIp(request, context));
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const signature = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body,
  });

  // De Mendrix order-ID's gaan terug naar de app, voor de QR-code op het label.
  // Alleen de ID's — de rest van het antwoord (o.a. SOAP-respons) blijft hier.
  const orderIds = res.ok ? await readOrderIds(res) : [];

  // Bewaar de ID's onder de aanmeldingscode, zodat de print-link uit de
  // bevestigingsmail (gemaakt vóór de orders bestonden) ze later kan ophalen.
  await saveOrderIds(readSubmissionId(body), orderIds);

  return new Response(JSON.stringify({ ok: res.ok, status: res.status, orderIds }), {
    status: res.ok ? 200 : 502,
  });
};

/**
 * Het IP van de gebruiker. De edge function ip-guard draait vóór deze functie,
 * waardoor context.ip en x-nf-client-connection-ip het adres van de edge zijn.
 * ip-guard geeft het echte IP daarom als header door (en overschrijft een
 * meegestuurde waarde). Zonder die header (geen edge) is context.ip wél juist.
 * Bewust niet x-forwarded-for: het eerste adres daarin kan de browser zelf meesturen.
 */
function resolveClientIp(request: Request, context: Context | undefined): string | undefined {
  const bronnen: [string, string | undefined][] = [
    [CLIENT_IP_HEADER, request.headers.get(CLIENT_IP_HEADER) ?? undefined],
    ['context.ip', context?.ip],
    ['x-nf-client-connection-ip', request.headers.get('x-nf-client-connection-ip') ?? undefined],
  ];
  const gevonden = bronnen.find(([, v]) => v && isIP(v.trim()));
  console.log(
    `[forward-webhook] client_ip=${gevonden?.[1]?.trim() ?? '(geen)'} via ${gevonden?.[0] ?? '-'}`,
    `| ${bronnen.map(([naam, v]) => `${naam}=${v ?? '(leeg)'}`).join(', ')}`,
  );
  return gevonden?.[1]?.trim();
}

/**
 * Zet het IP van de gebruiker in de body. create-order ziet zelf alleen het
 * (wisselende) AWS-adres van deze functie. In de body valt het onder de
 * HMAC-handtekening; een meegestuurde waarde van de browser wordt overschreven.
 */
function withClientIp(body: string, ip: string | undefined): string {
  try {
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return body;
    return JSON.stringify({ ...data, client_ip: ip || null });
  } catch {
    return body;
  }
}

function readSubmissionId(body: string): string | null {
  try {
    const id = (JSON.parse(body) as { submission_id?: unknown }).submission_id;
    return typeof id === 'string' && SUBMISSION_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Mislukt het opslaan, dan krijgt alleen de print-link geen QR-code — geen reden om te falen. */
async function saveOrderIds(submissionId: string | null, orderIds: (string | null)[]): Promise<void> {
  if (!submissionId || !orderIds.some(Boolean)) return;
  try {
    await getStore('order-ids').setJSON(submissionId, { orderIds, createdAt: Date.now() });
  } catch (err) {
    console.error("forward-webhook: order-ID's opslaan mislukt:", err instanceof Error ? err.message : err);
  }
}

/**
 * Leest per entry het order-ID uit het antwoord van create-order
 * (`{ resultaten: [{ succes, orderId }] }`, in dezelfde volgorde als de entries).
 * Een mislukte entry of een onverwacht antwoord geeft `null` / een lege lijst.
 */
async function readOrderIds(res: Response): Promise<(string | null)[]> {
  try {
    const data = (await res.json()) as { resultaten?: unknown };
    if (!Array.isArray(data.resultaten)) return [];
    return data.resultaten.map((r) => {
      const { succes, orderId } = (r ?? {}) as { succes?: unknown; orderId?: unknown };
      const id = String(orderId ?? '').trim();
      return succes === true && /^\d+$/.test(id) ? id : null;
    });
  } catch {
    return [];
  }
}
