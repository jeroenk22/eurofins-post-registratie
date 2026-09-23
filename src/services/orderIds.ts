/**
 * Mendrix order-ID's per aanmelding.
 *
 * Direct na versturen komen de ID's mee in het antwoord van forward-webhook.
 * De print-link uit de bevestigingsmail wordt gemaakt vóórdat de orders bestaan;
 * die bevat daarom alleen een willekeurige aanmeldingscode (`s`), waarmee de
 * pagina de ID's later ophaalt.
 */

/** Willekeurige, niet te raden code per aanmelding (16 tekens, base64url). */
export function newSubmissionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}

export const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/

/** Leest `{ orderIds: [...] }`; alles wat geen niet-lege string is wordt `null`. */
export function parseOrderIds(data: unknown): (string | null)[] {
  const ids = (data as { orderIds?: unknown } | null)?.orderIds
  if (!Array.isArray(ids)) return []
  return ids.map((id) => (typeof id === 'string' && id ? id : null))
}

/**
 * Haalt de order-ID's van een eerdere aanmelding op. Nooit een fout: bij een
 * onbekende code, een storing of na `timeoutMs` komt er een lege lijst terug,
 * en worden de labels zonder QR-code geprint.
 */
export async function fetchOrderIds(submissionId: string, timeoutMs = 4000): Promise<(string | null)[]> {
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) return []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`/.netlify/functions/order-ids?s=${encodeURIComponent(submissionId)}`, {
      signal: controller.signal,
    })
    if (!res.ok) return []
    return parseOrderIds(await res.json())
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
