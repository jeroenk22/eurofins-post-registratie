import { useEffect, useState } from 'react'

// Tailwind `md:` — hetzelfde breekpunt waarop de QR-code voor foto's verschijnt.
const DESKTOP_QUERY = '(min-width: 768px)'

function matches(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches
}

/** Breed scherm: per zending verzenden. Smal (telefoon): het formulier zoals altijd. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}
