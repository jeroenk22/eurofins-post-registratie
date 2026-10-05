import { useEffect, useState } from 'react'
import { fetchFotos } from '../services/aanmelding'
import { useAanmelding } from '../hooks/useAanmelding'
import { LinkFout, LinkLaden, LinkPagina } from './LinkPagina'

interface FotoPaginaProps {
  code: string
  /** Alleen deze zending tonen (entry_number). */
  zending?: number
}

/** Fotopagina via ?fotos=<code>[&zending=n]: foto's per zending, klik voor groot. */
export default function FotoPagina({ code, zending }: FotoPaginaProps) {
  const { state, opnieuw } = useAanmelding(() => fetchFotos(code, zending), `${code}/${zending ?? ''}`)
  const [groot, setGroot] = useState<{ data: string; naam: string } | null>(null)

  useEffect(() => {
    if (!groot) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setGroot(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [groot])

  if (state.status === 'laden') return <LinkLaden tekst="Foto's laden…" />
  if (state.status === 'fout') {
    return <LinkFout fout={state.fout} onOpnieuw={opnieuw} verlopenTekst="Deze fotolink is verlopen (ouder dan 30 dagen) of bestaat niet." />
  }

  const { zendingen } = state.data
  return (
    <LinkPagina breed>
      <h2 className="text-base font-bold text-gray-800 mb-4">Foto's van de aanmelding</h2>

      {zendingen.length === 0 && <p className="text-sm text-gray-500">Geen foto's gevonden.</p>}

      {zendingen.map((z) => (
        <section key={z.nr} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-800">{z.naam}</h3>
          <p className="text-xs text-gray-500 mb-2">{z.schap}</p>
          {z.fotos.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Geen foto's bij deze zending.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {z.fotos.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGroot({ data: f.data, naam: f.naam })}
                  className="block rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square"
                >
                  <img src={f.data} alt={f.naam} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
      ))}

      {groot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto bekijken"
          onClick={() => setGroot(null)}
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        >
          <img src={groot.data} alt={groot.naam} className="max-w-full max-h-full object-contain rounded-lg bg-white" />
          <button
            type="button"
            onClick={() => setGroot(null)}
            aria-label="Sluiten"
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white text-lg"
          >
            ✕
          </button>
        </div>
      )}
    </LinkPagina>
  )
}
