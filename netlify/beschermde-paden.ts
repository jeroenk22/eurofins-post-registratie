/** Eindpunten met persoonsgegevens: alleen hier wordt toegang gemeten/geblokkeerd. */
export const BESCHERMDE_PADEN = [
  '/.netlify/functions/sheets',
  '/.netlify/functions/forward-webhook',
  '/.netlify/functions/dagoverzicht',
  '/.netlify/functions/naar-make',
  '/.netlify/functions/aanmelding',
]

/**
 * Het pad wordt eerst gedecodeerd en in kleine letters gezet, zodat varianten als
 * %73heets, SHEETS of sheets/ het filter niet omzeilen. Een pad dat niet te
 * decoderen is, geldt als beschermd.
 */
export function isBeschermdPad(pathname: string): boolean {
  let pad: string
  try {
    pad = decodeURIComponent(pathname).toLowerCase()
  } catch {
    return true
  }
  return BESCHERMDE_PADEN.some((beschermd) => pad === beschermd || pad.startsWith(`${beschermd}/`))
}
