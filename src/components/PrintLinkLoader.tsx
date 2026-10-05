import { fetchLabels } from '../services/aanmelding'
import { useAanmelding } from '../hooks/useAanmelding'
import PrintLinkScreen from './PrintLinkScreen'
import { LinkFout, LinkLaden } from './LinkPagina'

/** Printpagina via ?s=<code>: laadt de labels van de server (met order-ID's) vóór het scherm. */
export default function PrintLinkLoader({ code }: { code: string }) {
  const { state, opnieuw } = useAanmelding(() => fetchLabels(code), code)
  if (state.status === 'laden') return <LinkLaden tekst="Labels laden…" />
  if (state.status === 'fout') return <LinkFout fout={state.fout} onOpnieuw={opnieuw} />
  // Order-ID's zitten al in de labels: geen aparte submissionId nodig.
  return <PrintLinkScreen entries={state.data.labels} />
}
