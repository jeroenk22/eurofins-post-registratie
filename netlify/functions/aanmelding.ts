import { getStore } from '@netlify/blobs';
import {
  AANMELDINGEN_STORE, AANMELDING_BEWAARTERMIJN_MS, CODE_PATTERN, fotosKey, labelsKey,
  type FotosAntwoord, type LabelsAntwoord, type OpgeslagenFotos, type OpgeslagenLabels,
} from '../aanmelding-opslag';

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const verlopen = () => json({ error: 'verlopen' }, 404);

const isVerlopen = (createdAt: unknown) =>
  typeof createdAt !== 'number' || Date.now() - createdAt > AANMELDING_BEWAARTERMIJN_MS;

type Store = ReturnType<typeof getStore>;

/**
 * Geeft de labels of foto's van een aanmelding terug, voor de printlink (?s=) en
 * de fotolink (?fotos=) uit de mails. Opvragen kan alleen met de onraadbare
 * aanmeldingscode. Nooit namen of adressen loggen.
 */
export default async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const params = new URL(request.url).searchParams;
  const code = params.get('s') ?? '';
  if (!CODE_PATTERN.test(code)) return json({ error: 'Ongeldige code' }, 400);

  const soort = params.get('soort');
  if (soort !== 'labels' && soort !== 'fotos') return json({ error: 'Ongeldige soort' }, 400);

  let zending: number | undefined;
  const zendingParam = params.get('zending');
  if (zendingParam !== null) {
    if (!/^[1-9]\d{0,3}$/.test(zendingParam)) return json({ error: 'Ongeldige zending' }, 400);
    zending = Number(zendingParam);
  }

  try {
    const store = getStore({ name: AANMELDINGEN_STORE, consistency: 'strong' });
    return soort === 'labels' ? await labels(store, code) : await fotos(store, code, zending);
  } catch (err) {
    console.error('aanmelding: ophalen mislukt:', err instanceof Error ? err.message : err);
    return json({ error: 'Ophalen mislukt' }, 500);
  }
};

// Strong: de mail kan binnen seconden na het opslaan geopend worden.
const lees = <T>(store: Store, key: string) =>
  store.get(key, { type: 'json', consistency: 'strong' }) as Promise<T | null>;

async function labels(store: Store, code: string): Promise<Response> {
  const opgeslagen = await lees<OpgeslagenLabels>(store, labelsKey(code));
  if (!opgeslagen || !Array.isArray(opgeslagen.labels) || isVerlopen(opgeslagen.createdAt)) return verlopen();

  const orderIds = await leesOrderIds(code);
  const antwoord: LabelsAntwoord = {
    labels: opgeslagen.labels.map((l, i) => (l.orderId || !orderIds[i] ? l : { ...l, orderId: orderIds[i] as string })),
  };
  return json(antwoord, 200);
}

async function leesOrderIds(code: string): Promise<(string | null)[]> {
  try {
    const stored = (await getStore('order-ids').get(code, { type: 'json', consistency: 'strong' })) as
      | { orderIds?: unknown }
      | null;
    return stored && Array.isArray(stored.orderIds) ? (stored.orderIds as (string | null)[]) : [];
  } catch {
    // Zonder order-ID's blijft het label bruikbaar, alleen zonder QR-code.
    return [];
  }
}

async function fotos(store: Store, code: string, zending: number | undefined): Promise<Response> {
  const nummers = zending !== undefined ? [zending] : await zendingNummers(store, code);
  const zendingen: FotosAntwoord['zendingen'] = [];
  for (const nr of nummers) {
    const f = await lees<OpgeslagenFotos>(store, fotosKey(code, nr));
    if (!f || !Array.isArray(f.fotos) || isVerlopen(f.createdAt)) continue;
    zendingen.push({ nr, naam: f.naam, schap: f.schap, fotos: f.fotos });
  }
  if (zendingen.length === 0) {
    // Geen foto's: bestaat de aanmelding zelf nog (labels), dan is dat geen verlopen link.
    const l = await lees<OpgeslagenLabels>(store, labelsKey(code));
    if (!l || isVerlopen(l.createdAt)) return verlopen();
  }
  const antwoord: FotosAntwoord = { zendingen };
  return json(antwoord, 200);
}

async function zendingNummers(store: Store, code: string): Promise<number[]> {
  const prefix = `${code}/fotos/`;
  const { blobs } = await store.list({ prefix });
  return blobs
    .map(b => Number(b.key.slice(prefix.length)))
    .filter(n => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
}
