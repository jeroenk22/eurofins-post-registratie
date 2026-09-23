import { getStore } from '@netlify/blobs';

/** Zelfde vorm als newSubmissionId() in de app: 16 tekens base64url. */
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;

const HEADERS = { 'Content-Type': 'application/json' };

/**
 * Geeft de Mendrix order-ID's van een aanmelding terug, zodat de print-link uit
 * de bevestigingsmail de QR-codes op de labels kan zetten. Opvragen kan alleen
 * met de willekeurige aanmeldingscode uit die link.
 */
export default async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
  }

  const submissionId = new URL(request.url).searchParams.get('s') ?? '';
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
    return new Response(JSON.stringify({ error: 'Ongeldige code' }), { status: 400, headers: HEADERS });
  }

  try {
    const stored = (await getStore('order-ids').get(submissionId, { type: 'json' })) as
      | { orderIds?: unknown }
      | null;
    if (!stored || !Array.isArray(stored.orderIds)) {
      return new Response(JSON.stringify({ error: 'Niet gevonden' }), { status: 404, headers: HEADERS });
    }
    return new Response(JSON.stringify({ orderIds: stored.orderIds }), { status: 200, headers: HEADERS });
  } catch (err) {
    console.error("order-ids: ophalen mislukt:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'Ophalen mislukt' }), { status: 500, headers: HEADERS });
  }
};
