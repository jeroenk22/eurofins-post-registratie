import type { PostEntry } from './types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[+]?[\d\s\-().]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone)
}

export function validateForm(
  entries: PostEntry[],
  senderName: string,
  senderEmail: string,
  senderCcEmail: string = '',
  senderPhone: string = '',
): string | null {
  if (entries.some((e) => !e.shelf))
    return 'Selecteer bij elke zending een schap nummer.'
  if (entries.some((e) => e.shelf === 'overig' && !e.shelfDescription.trim()))
    return 'Beschrijf waar de zending klaar ligt bij "Overig".'
  if (entries.some((e) => !e.name.trim()))
    return 'Vul bij elke zending een naam of bedrijf in.'
  if (entries.some((e) =>
    Array.from({ length: e.colli }, (_, i) => (e.colliOmschrijvingen ?? [])[i] ?? '').some(v => !v.trim())
  ))
    return 'Vul bij elke zending een omschrijving in voor elk collo.'
  if (entries.some((e) => e.photos.length === 0))
    return 'Voeg bij elke zending minimaal 1 foto toe.'
  if (!senderName.trim())
    return 'Vul je naam in (onderaan het formulier).'
  if (senderPhone.trim() && !isValidPhone(senderPhone.trim()))
    return 'Vul een geldig telefoonnummer in (alleen cijfers, spaties en koppeltekens).'
  if (senderEmail.trim() && !isValidEmail(senderEmail.trim()))
    return 'Vul een geldig e-mailadres in.'
  if (senderCcEmail.trim() && !isValidEmail(senderCcEmail.trim()))
    return 'Vul een geldig CC e-mailadres in.'
  return null
}
