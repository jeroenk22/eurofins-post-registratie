/**
 * Geeft de huidige servertijd terug als ISO-tijdstip (UTC).
 *
 * De app gebruikt dit in plaats van de klok van de werkplek: een pc met een
 * verkeerd lopende klok zou anders een verkeerde datum op het verzendlabel
 * en in de webhook-payload zetten.
 */
export default async (): Promise<Response> =>
  new Response(JSON.stringify({ now: new Date().toISOString() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
