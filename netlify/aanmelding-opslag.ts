/**
 * Afspraken tussen de app, naar-make, dagoverzicht en de functie aanmelding:
 * labelgegevens (printlink) en foto's staan op de server onder een onraadbare
 * code, zodat er geen persoonsgegevens in links of in een openbare Drive-map staan.
 *
 * Sleutels in AANMELDINGEN_STORE:
 *   `${code}/labels`          → OpgeslagenLabels
 *   `${code}/fotos/${nr}`     → OpgeslagenFotos   (nr = entry_number, vanaf 1)
 *
 * Endpoint GET /.netlify/functions/aanmelding (beschermd door ip-guard):
 *   ?s=<code>&soort=labels               → 200 LabelsAntwoord
 *   ?s=<code>&soort=fotos[&zending=<nr>] → 200 FotosAntwoord (alleen die zending als nr gegeven)
 *                                          Geen (geldige) foto's maar labels bestaan nog → 200 { zendingen: [] }
 *   onbekende of verlopen code           → 404 { error: 'verlopen' }
 *   ongeldige parameters                 → 400 { error: string }
 */

export const AANMELDINGEN_STORE = 'aanmeldingen'

/** Zelfde vorm als newSubmissionId() in de app: 16 tekens base64url. */
export const CODE_PATTERN = /^[A-Za-z0-9_-]{16}$/

/** Bewaartermijn (AVG), gelijk aan die van de order-ID's: gekozen op 02-10-2026. */
export const AANMELDING_BEWAARTERMIJN_MS = 30 * 24 * 60 * 60 * 1000

/** Zelfde velden als PrintEntry in src/services/printService.ts. */
export interface Label {
  name: string
  adres: string
  postcode: string
  plaats: string
  route: string
  colli: number
  colliOmschrijvingen: string[]
  spoed: boolean
  land: string
  orderedAt?: string
  orderId?: string
}

export interface OpgeslagenLabels {
  labels: Label[]
  createdAt: number
}

export interface Foto {
  /** Bestandsnaam zoals in de payload. */
  naam: string
  /** data-URL (data:image/jpeg;base64,...). */
  data: string
}

export interface OpgeslagenFotos {
  /** Ontvanger zoals in de payload (recipient). */
  naam: string
  /** "Schap 3" of "Overig: ..." (shelf uit de payload). */
  schap: string
  fotos: Foto[]
  createdAt: number
}

export interface LabelsAntwoord {
  /** Met orderId ingevuld uit de order-ids-store waar het label er nog geen had. */
  labels: Label[]
}

export interface FotosAntwoord {
  zendingen: { nr: number; naam: string; schap: string; fotos: Foto[] }[]
}

export const labelsKey = (code: string) => `${code}/labels`
export const fotosKey = (code: string, nr: number) => `${code}/fotos/${nr}`
