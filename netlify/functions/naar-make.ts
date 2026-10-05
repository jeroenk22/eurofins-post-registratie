import { getStore } from '@netlify/blobs';
import {
  AANMELDINGEN_STORE, CODE_PATTERN, fotosKey, labelsKey,
  type Label, type OpgeslagenFotos, type OpgeslagenLabels,
} from '../aanmelding-opslag';

/**
 * Stuurt een aanmelding door naar de Make-webhook. De URL staat alleen hier
 * (server-side), zodat hij niet in de publieke JS-bundel zit.
 * Nooit de Make-URL of het antwoord van Make teruggeven of loggen.
 *
 * Eerst worden de labels en de foto's opgeslagen onder de aanmeldingscode (voor
 * de printlink en de fotolink in de mails). Lukt dat niet, dan gaat er niets
 * naar Make: er komt nooit een mail met een dode link. Make krijgt de payload
 * zonder het veld `labels`; de rest gaat ongewijzigd door.
 */
export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const targetUrl = process.env.MAKE_WEBHOOK_URL;
  if (!targetUrl) {
    console.error('naar-make: MAKE_WEBHOOK_URL niet ingesteld');
    return json({ error: 'Make-koppeling niet ingesteld' }, 503);
  }

  const body = await request.text();
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return json({ error: 'Ongeldige JSON' }, 400);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ error: 'Ongeldige JSON' }, 400);
  }

  const payload = data as Record<string, unknown>;
  const submissionId = payload.submission_id;
  const logId = typeof submissionId === 'string' ? submissionId.slice(0, 32) : '-';
  if (typeof submissionId !== 'string' || !CODE_PATTERN.test(submissionId)) {
    return json({ error: 'Ongeldige submission_id' }, 400);
  }

  try {
    await bewaar(submissionId, payload);
  } catch (err) {
    console.error(`naar-make: opslaan mislukt (submission_id=${logId}):`, err instanceof Error ? err.message : err);
    return json({ ok: false, error: 'opslaan mislukt' }, 500);
  }

  // Zonder `labels` gaat de originele tekst door; anders alles behalve `labels`.
  let doorgestuurd = body;
  if ('labels' in payload) {
    const { labels: _labels, ...rest } = payload;
    doorgestuurd = JSON.stringify(rest);
  }

  // Optioneel: met een API-sleutel op de Make-webhook kan alleen deze functie hem aanroepen. Nooit loggen.
  const apiKey = process.env.MAKE_WEBHOOK_KEY;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: apiKey ? { 'Content-Type': 'application/json', 'x-make-apikey': apiKey } : { 'Content-Type': 'application/json' },
      body: doorgestuurd,
    });
    if (!res.ok) {
      console.error(`naar-make: Make gaf status ${res.status} (submission_id=${logId})`);
      return json({ ok: false, status: res.status }, 502);
    }
    return json({ ok: true }, 200);
  } catch {
    console.error(`naar-make: Make niet bereikbaar (submission_id=${logId})`);
    return json({ ok: false }, 502);
  }
};

function geldigeLabels(v: unknown): v is Label[] {
  return Array.isArray(v) && v.every(l => !!l && typeof l === 'object' && typeof (l as { name?: unknown }).name === 'string');
}

const tekst = (v: unknown) => (typeof v === 'string' ? v : '');

/** Slaat labels en foto's op; gooit bij een fout. Ontbrekende of ongeldige labels worden overgeslagen. */
async function bewaar(code: string, payload: Record<string, unknown>): Promise<void> {
  const store = getStore(AANMELDINGEN_STORE);
  const createdAt = Date.now();

  if (geldigeLabels(payload.labels)) {
    const labels: OpgeslagenLabels = { labels: payload.labels, createdAt };
    await store.setJSON(labelsKey(code), labels);
  }

  if (!Array.isArray(payload.entries)) return;
  for (const raw of payload.entries) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const nr = Number(e.entry_number);
    if (!Array.isArray(e.photos) || !Number.isInteger(nr) || nr < 1) continue;
    const fotos = e.photos
      .map(f => (f ?? {}) as Record<string, unknown>)
      .filter(f => typeof f.base64 === 'string' && f.base64)
      .map(f => ({ naam: tekst(f.filename), data: f.base64 as string }));
    if (fotos.length === 0) continue;
    const opgeslagen: OpgeslagenFotos = { naam: tekst(e.recipient), schap: tekst(e.shelf), fotos, createdAt };
    await store.setJSON(fotosKey(code, nr), opgeslagen);
  }
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
