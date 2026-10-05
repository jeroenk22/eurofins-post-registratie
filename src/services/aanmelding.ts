import type { FotosAntwoord, LabelsAntwoord } from '../../netlify/aanmelding-opslag'
import { SUBMISSION_ID_PATTERN } from './orderIds'

/** Waarom laden mislukte: bepaalt welk foutscherm de pagina toont. */
export type AanmeldingFout = 'verlopen' | 'netwerk' | 'andere'

export class AanmeldingError extends Error {
  readonly soort: AanmeldingFout
  constructor(soort: AanmeldingFout) {
    super(soort)
    this.name = 'AanmeldingError'
    this.soort = soort
  }
}

/**
 * Haalt labels of foto's van een aanmelding op bij de server. Gooit een
 * AanmeldingError: 404 → verlopen, 403 → netwerk (ip-guard), rest → andere.
 */
async function fetchAanmelding<T>(code: string, query: string): Promise<T> {
  if (!SUBMISSION_ID_PATTERN.test(code)) throw new AanmeldingError('verlopen')
  let res: Response
  try {
    res = await fetch(`/.netlify/functions/aanmelding?s=${encodeURIComponent(code)}&${query}`)
  } catch {
    throw new AanmeldingError('andere')
  }
  if (res.status === 404) throw new AanmeldingError('verlopen')
  if (res.status === 403) throw new AanmeldingError('netwerk')
  if (!res.ok) throw new AanmeldingError('andere')
  try {
    return (await res.json()) as T
  } catch {
    throw new AanmeldingError('andere')
  }
}

export const fetchLabels = (code: string) =>
  fetchAanmelding<LabelsAntwoord>(code, 'soort=labels')

export const fetchFotos = (code: string, zending?: number) =>
  fetchAanmelding<FotosAntwoord>(code, `soort=fotos${zending ? `&zending=${zending}` : ''}`)
