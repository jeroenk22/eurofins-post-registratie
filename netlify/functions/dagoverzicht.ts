import { dagoverzichtHtml, dagoverzichtSubject, type DagoverzichtItem } from '../dagoverzicht-mail';

const HEADERS = { 'Content-Type': 'application/json' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ITEMS = 300;

/**
 * Verstuurt het dagoverzicht van een werkplek als opgemaakte mail. De HTML wordt
 * hier gebouwd (niet in de browser), zodat er nooit HTML van buiten in een mail
 * van Miedema komt. Make (apart scenario, Gmail) verstuurt hem alleen.
 */
export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookUrl = process.env.DAGOVERZICHT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('dagoverzicht: DAGOVERZICHT_WEBHOOK_URL niet ingesteld');
    return json({ error: 'Het dagoverzicht per mail is nog niet ingesteld.' }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ongeldige JSON' }, 400);
  }
  const parsed = parse(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);

  const now = new Date();
  // Logo's van de productiesite: een preview-adres verdwijnt, de mail blijft.
  const assetBase = process.env.URL ?? new URL(request.url).origin;
  const payload = {
    to: parsed.to,
    cc: parsed.cc,
    subject: dagoverzichtSubject(parsed.items, now),
    html: dagoverzichtHtml({ senderName: parsed.senderName, items: parsed.items }, now, assetBase),
  };

  try {
    // Met een API-sleutel op de Make-webhook kan alleen deze functie het scenario aanroepen.
    const apiKey = process.env.DAGOVERZICHT_WEBHOOK_KEY;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: apiKey ? { ...HEADERS, 'x-make-apikey': apiKey } : HEADERS,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`dagoverzicht: Make antwoordde ${res.status}`);
      return json({ error: `Versturen mislukt (Make ${res.status})` }, 502);
    }
  } catch (err) {
    console.error('dagoverzicht: Make onbereikbaar:', err instanceof Error ? err.message : err);
    return json({ error: 'Versturen mislukt (Make onbereikbaar)' }, 502);
  }
  return json({ ok: true }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function parse(
  body: unknown,
): { to: string; cc: string; senderName: string; items: DagoverzichtItem[] } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const to = str(b.to);
  const cc = str(b.cc);
  if (!EMAIL.test(to)) return { error: 'Ongeldig e-mailadres' };
  if (cc && !EMAIL.test(cc)) return { error: 'Ongeldig CC-adres' };
  if (!Array.isArray(b.items) || b.items.length === 0) return { error: 'Geen zendingen' };
  if (b.items.length > MAX_ITEMS) return { error: 'Te veel zendingen' };

  const items: DagoverzichtItem[] = [];
  for (const raw of b.items) {
    const i = (raw ?? {}) as Record<string, unknown>;
    const sentAt = str(i.sentAt, 40);
    const colli = Number(i.colli);
    if (Number.isNaN(Date.parse(sentAt)) || !Number.isInteger(colli) || colli < 1 || colli > 99) {
      return { error: 'Ongeldige zending' };
    }
    const orderId = str(i.orderId, 20);
    items.push({
      sentAt,
      orderId: /^\d+$/.test(orderId) ? orderId : null,
      name: str(i.name),
      route: str(i.route, 60),
      colli,
      colliOmschrijvingen: Array.isArray(i.colliOmschrijvingen)
        ? i.colliOmschrijvingen.slice(0, 99).map(v => str(v, 120))
        : [],
      spoed: i.spoed === true,
    });
  }
  return { to, cc, senderName: str(b.senderName, 100), items };
}
