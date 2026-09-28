/**
 * Instellingen die alleen de desktop kent, per werkplek bewaard.
 * Afzender en labelformaat staan elders (useStore, printService).
 */
const MAIL_PER_ZENDING_KEY = 'mail_per_zending'

/** Bevestigingsmail van Make bij elke verzonden zending. Standaard aan, zoals altijd. */
export function getMailPerZending(): boolean {
  try {
    return localStorage.getItem(MAIL_PER_ZENDING_KEY) !== 'uit'
  } catch {
    return true
  }
}

export function setMailPerZending(aan: boolean): void {
  try {
    localStorage.setItem(MAIL_PER_ZENDING_KEY, aan ? 'aan' : 'uit')
  } catch {
    // Geen opslag: de keuze geldt dan alleen voor deze sessie.
  }
}
