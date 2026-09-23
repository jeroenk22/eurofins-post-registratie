import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrintLinkScreen from '../components/PrintLinkScreen'
import type { PrintEntry } from '../services/printService'

const entries: PrintEntry[] = [
  { name: 'Bart Wijtvliet', adres: 'Kerkstraat 1', postcode: '1234AB', plaats: 'Zevenbergen', land: 'Nederland', route: 'Route 5', colli: 3, colliOmschrijvingen: [], spoed: false },
  { name: 'Adrie Bakker', adres: 'Dorpsweg 5', postcode: '5678CD', plaats: 'Ovezande', land: 'Nederland', route: 'Route 5', colli: 2, colliOmschrijvingen: [], spoed: false },
]

describe('PrintLinkScreen', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
  })

  it('toont alle entries', () => {
    render(<PrintLinkScreen entries={entries} />)
    expect(screen.getByText(/Bart Wijtvliet/)).toBeInTheDocument()
    expect(screen.getByText(/Adrie Bakker/)).toBeInTheDocument()
  })

  it('toont totaal aantal colli in de print-all knop', () => {
    render(<PrintLinkScreen entries={entries} />)
    expect(screen.getByText('Print alle labels (5 colli)')).toBeInTheDocument()
  })

  it('navigeert naar / bij klikken op Nieuwe aanmelding', () => {
    render(<PrintLinkScreen entries={entries} />)
    fireEvent.click(screen.getByText('+ Nieuwe aanmelding'))
    expect(window.location.href).toBe('/')
  })
})

describe('PrintLinkScreen — QR-codes via de aanmeldingscode', () => {
  const code = 'abcdEFGH1234_-xy'
  let printedHtml: string[]

  beforeEach(() => {
    printedHtml = []
    const mockWin = {
      document: { write: vi.fn((html: string) => { printedHtml.push(html) }), close: vi.fn() },
      focus: vi.fn(), print: vi.fn(), close: vi.fn(),
    }
    vi.stubGlobal('open', vi.fn().mockReturnValue(mockWin))
  })
  afterEach(() => vi.unstubAllGlobals())

  const orderIdsAntwoord = (orderIds: unknown[]) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ orderIds }) }))

  it('zet de opgehaalde order-ID\'s als QR-code op de labels, per entry', async () => {
    orderIdsAntwoord(['1234567', null])
    render(<PrintLinkScreen entries={entries} submissionId={code} />)
    fireEvent.click(await screen.findByText('Print alle labels (5 colli)'))
    // Entry 1 heeft 3 colli met een order-ID, entry 2 (2 colli) niet
    expect(printedHtml[0].match(/<svg class="qr"/g)).toHaveLength(3)
    expect(printedHtml[0]).toContain('Order 1234567')
  })

  it('gebruikt het juiste order-ID bij printen per entry', async () => {
    orderIdsAntwoord(['1111111', '2222222'])
    render(<PrintLinkScreen entries={entries} submissionId={code} />)
    await screen.findByText('Print alle labels (5 colli)')
    fireEvent.click(screen.getByText('Print 2 labels'))
    expect(printedHtml[0]).toContain('Order 2222222')
    expect(printedHtml[0]).not.toContain('1111111')
  })

  it('houdt de printknoppen kort uit tot de ID\'s binnen zijn', async () => {
    let resolve!: (v: unknown) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { resolve = r })))
    render(<PrintLinkScreen entries={entries} submissionId={code} />)
    expect(screen.getByText('Labels voorbereiden…').closest('button')).toBeDisabled()
    resolve({ ok: true, json: () => Promise.resolve({ orderIds: ['1'] }) })
    expect(await screen.findByText('Print alle labels (5 colli)')).toBeEnabled()
  })

  it('print zonder QR-code als ophalen mislukt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    render(<PrintLinkScreen entries={entries} submissionId={code} />)
    fireEvent.click(await screen.findByText('Print alle labels (5 colli)'))
    expect(printedHtml[0]).not.toContain('<svg class="qr"')
  })

  it('haalt niets op bij een oude link zonder aanmeldingscode', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<PrintLinkScreen entries={entries} />)
    expect(screen.getByText('Print alle labels (5 colli)')).toBeEnabled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
