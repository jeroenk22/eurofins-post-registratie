import type { ReactNode } from 'react'
import Header from './Header'
import type { AanmeldingFout } from '../services/aanmelding'

/** Pagina in de stijl van de app voor linkpagina's (print en foto's). */
export function LinkPagina({ children, breed = false }: { children: ReactNode; breed?: boolean }) {
  return (
    <div className="min-h-scherm bg-gray-50">
      <div className={`${breed ? 'max-w-4xl' : 'max-w-lg'} mx-auto min-h-scherm bg-white shadow-sm flex flex-col`}>
        <Header />
        <div className="flex-1 px-4 pt-6 pb-10">{children}</div>
      </div>
    </div>
  )
}

export function LinkLaden({ tekst }: { tekst: string }) {
  return (
    <LinkPagina>
      <p role="status" className="text-sm text-gray-500 text-center py-10">{tekst}</p>
    </LinkPagina>
  )
}

const MELDING: Record<AanmeldingFout, string> = {
  verlopen: 'Deze printlink is verlopen (ouder dan 30 dagen) of bestaat niet.',
  netwerk: 'Deze link werkt alleen vanaf een goedgekeurd netwerk.',
  andere: 'Laden mislukt, probeer het opnieuw.',
}

export function LinkFout({ fout, onOpnieuw, verlopenTekst }: { fout: AanmeldingFout; onOpnieuw: () => void; verlopenTekst?: string }) {
  const tekst = fout === 'verlopen' && verlopenTekst ? verlopenTekst : MELDING[fout]
  return (
    <LinkPagina>
      <div role="alert" className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 mb-4">
        {tekst}
      </div>
      {fout === 'andere' && (
        <button
          type="button"
          onClick={onOpnieuw}
          className="px-5 py-2.5 rounded-lg bg-ef-blue text-white text-sm font-semibold hover:bg-ef-blue/90 transition-colors"
        >
          Opnieuw proberen
        </button>
      )}
    </LinkPagina>
  )
}
