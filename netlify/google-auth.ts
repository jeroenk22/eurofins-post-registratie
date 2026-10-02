import { JWT } from 'google-auth-library'

/** Ontbrekende service-account-env; de aanroeper kan hier een nette 503 of log van maken. */
export class GoogleAuthConfigError extends Error {
  constructor() {
    super('GOOGLE_SA_EMAIL of GOOGLE_SA_PRIVATE_KEY ontbreekt')
    this.name = 'GoogleAuthConfigError'
  }
}

// Eén client per scope en functie-instantie: de library cachet en vernieuwt het access token zelf
const clients = new Map<string, { sleutel: string; client: JWT }>()

function getClient(scope: string, email: string, privateKey: string): JWT {
  // Letterlijke \n (zoals geplakt in de Netlify-UI) omzetten naar echte newlines
  const key = privateKey.replace(/\\n/g, '\n')
  const sleutel = `${email}\n${key}`
  const bestaand = clients.get(scope)
  if (bestaand && bestaand.sleutel === sleutel) return bestaand.client
  const client = new JWT({ email, key, scopes: [scope] })
  clients.set(scope, { sleutel, client })
  return client
}

/** Access token van het service account voor de gegeven scope. */
export async function googleAccessToken(scope: string): Promise<string> {
  const email = process.env.GOOGLE_SA_EMAIL
  const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY
  if (!email || !privateKey) throw new GoogleAuthConfigError()
  const { token } = await getClient(scope, email, privateKey).getAccessToken()
  if (!token) throw new Error('Geen access token ontvangen van Google')
  return token
}
