import { getStore } from '@netlify/blobs';
import { randomBytes } from 'node:crypto';
import { AANMELDINGEN_STORE, CODE_PATTERN, labelsKey, type Label, type OpgeslagenLabels } from '../aanmelding-opslag';
import { dagoverzichtHtml, dagoverzichtSubject, type DagoverzichtItem } from '../dagoverzicht-mail';

const HEADERS = { 'Content-Type': 'application/json' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ITEMS = 300;
/** Legacy: encodePrintData() van een oude client, base64url. */
const PRINT_DATA = /^[A-Za-z0-9_-]{1,60000}$/;
const MAX_LABELS = 300;

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
  // Logo's van de site waarop deze functie draait: productie, of de preview
  // (daar staan ze vóór de merge al; op productie nog niet).
  const assetBase = new URL(request.url).origin;
  // De labels staan op de server onder een nieuwe, onraadbare code: de link bevat geen gegevens.
  const printCode = parsed.labels ? await bewaarLabels(parsed.labels) : undefined;
  const printUrl = printCode ? `${assetBase}/?s=${printCode}` : undefined;
  const payload = {
    to: parsed.to,
    cc: parsed.cc,
    subject: dagoverzichtSubject(parsed.items, now),
    html: dagoverzichtHtml({ senderName: parsed.senderName, items: parsed.items, printUrl }, now, assetBase),
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

/** Geeft de nieuwe code, of undefined als opslaan mislukt (dan geen printknop in de mail). */
async function bewaarLabels(labels: Label[]): Promise<string | undefined> {
  const code = randomBytes(12).toString('base64url');
  try {
    const opgeslagen: OpgeslagenLabels = { labels, createdAt: Date.now() };
    await getStore(AANMELDINGEN_STORE).setJSON(labelsKey(code), opgeslagen);
    return code;
  } catch (err) {
    console.error('dagoverzicht: labels opslaan mislukt:', err instanceof Error ? err.message : err);
    return undefined;
  }
}

/** Ongeldig of leeg: dan gewoon geen printknop in de mail. */
function geldigeLabels(v: unknown): Label[] | undefined {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_LABELS) return undefined;
  const ok = v.every(l => !!l && typeof l === 'object' && typeof (l as { name?: unknown }).name === 'string');
  return ok ? (v as Label[]) : undefined;
}

/** Spiegel van decodePrintData() in de app: base64url naar een JSON-array. */
function decodeLegacyPrintData(encoded: string): Label[] | undefined {
  try {
    return geldigeLabels(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
  } catch {
    return undefined;
  }
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function parse(
  body: unknown,
): { to: string; cc: string; senderName: string; items: DagoverzichtItem[]; labels?: Label[] } | { error: string } {
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
      ...fotoVelden(i),
    });
  }
  const labels =
    geldigeLabels(b.labels) ??
    (typeof b.printData === 'string' && PRINT_DATA.test(b.printData) ? decodeLegacyPrintData(b.printData) : undefined);
  return { to, cc, senderName: str(b.senderName, 100), items, labels };
}

/** De fotolink komt alleen bij een geldige code en minstens één foto. */
function fotoVelden(i: Record<string, unknown>): { submissionId?: string; fotoCount?: number } {
  const fotoCount = Number(i.fotoCount);
  if (typeof i.submissionId !== 'string' || !CODE_PATTERN.test(i.submissionId) || !(fotoCount > 0)) return {};
  return { submissionId: i.submissionId, fotoCount };
}
