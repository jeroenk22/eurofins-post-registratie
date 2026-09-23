import type { Context } from '@netlify/functions';

// TIJDELIJK — diagnose voor PR #55; vóór de merge verwijderen.
export default async (request: Request, context: Context): Promise<Response> => {
  const headers = Object.fromEntries(
    [...request.headers.entries()].filter(([k]) => /ip|forwarded|x-nf|client/i.test(k)),
  );
  return new Response(JSON.stringify({ contextIp: context?.ip ?? null, headers }, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
};
