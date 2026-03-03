import type { PostEntry } from './types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function validateForm(
  entries: PostEntry[],
  senderName: string,
  senderEmail: string,
): string | null {
  if (entries.some((e) => !e.shelf))
    return 'Selecteer bij elke zending een schap nummer.'
  if (entries.some((e) => !e.name.trim()))
    return 'Vul bij elke zending een naam of bedrijf in.'
  if (!senderName.trim())
    return 'Vul je naam in (onderaan het formulier).'
  if (senderEmail.trim() && !isValidEmail(senderEmail.trim()))
    return 'Vul een geldig e-mailadres in.'
  return null
}
