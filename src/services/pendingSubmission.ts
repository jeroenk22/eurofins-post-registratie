import type { PendingSubmission } from '../webhookService'

/**
 * Aanmelding waarvan de Mendrix-orders al bestaan maar Make nog niet bereikt is
 * (zie SubmitError). Bewaard in de sessie, zodat ook na een refresh de nieuwe
 * poging alleen naar Make gaat. Op de desktop hoort er één zending bij (`entryId`).
 */
export type StoredPending = PendingSubmission & { entryId?: string }

const KEY = 'submit_pending'

export function loadPending(): StoredPending | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as StoredPending | null
  } catch {
    return null
  }
}

export function savePending(pending: StoredPending): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    // Te groot door de foto's: dan alleen in het geheugen (tot een refresh).
  }
}

export function clearPending(): void {
  sessionStorage.removeItem(KEY)
}

export const PENDING_HINT =
  ' — de order in Mendrix is wél al aangemaakt. Probeer het opnieuw; er komt geen tweede order. Wijzigingen in het formulier gaan niet meer mee.'
