/**
 * Stuurt een aanmelding door naar de Make-webhook. De URL staat alleen hier
 * (server-side), zodat hij niet in de publieke JS-bundel zit.
 * Nooit de Make-URL of het antwoord van Make teruggeven of loggen.
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

  const submissionId = (data as { submission_id?: unknown }).submission_id;
  const logId = typeof submissionId === 'string' ? submissionId.slice(0, 32) : '-';

  try {
    // De originele tekst gaat ongewijzigd door: Make krijgt exact wat de browser stuurde.
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
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

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
