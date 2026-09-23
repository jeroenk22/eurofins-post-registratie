export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const targetUrl = process.env.NETLIFY_WEBHOOK_URL;
  const secret = process.env.NETLIFY_WEBHOOK_SECRET;

  if (!targetUrl || !secret) {
    console.error('forward-webhook: NETLIFY_WEBHOOK_URL of NETLIFY_WEBHOOK_SECRET niet ingesteld');
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500 });
  }

  const body = await request.text();
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

  return new Response(JSON.stringify({ ok: res.ok, status: res.status, orderIds }), {
    status: res.ok ? 200 : 502,
  });
};

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
