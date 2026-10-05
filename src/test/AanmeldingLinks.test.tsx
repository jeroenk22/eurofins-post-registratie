import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from '../App'
import { encodePrintData, type PrintEntry } from '../services/printService'
import type { FotosAntwoord, Label } from '../../netlify/aanmelding-opslag'

vi.mock('../hooks/useRecipientData', () => ({ useRecipientData: vi.fn(() => ({ recipients: [] })) }))
vi.mock('../components/PwaInstallBanner', () => ({ default: () => null }))
vi.mock('../components/QrCodeFloat', () => ({ default: () => null }))

const CODE = 'abcdEFGH1234_-xy'

const label = (over: Partial<Label> = {}): Label => ({
  name: 'Bart Wijtvliet', adres: 'Kerkstraat 1', postcode: '1234AB', plaats: 'Zevenbergen', land: 'Nederland',
  route: 'Route 5', colli: 3, colliOmschrijvingen: [], spoed: false, ...over,
})

const gaNaar = (search: string) => window.history.pushState({}, '', `/${search}`)
const antwoord = (status: number, body: unknown = {}) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals(); gaNaar('') })

describe('App - printpagina via ?s=', () => {
  let printedHtml: string[]
  beforeEach(() => {
    printedHtml = []
    vi.stubGlobal('open', vi.fn().mockReturnValue({
      document: { write: vi.fn((h: string) => { printedHtml.push(h) }), close: vi.fn() },
      focus: vi.fn(), print: vi.fn(), close: vi.fn(),
    }))
  })

  it('laadt de labels van de server, toont een laadstatus en print met order-ID', async () => {
    let klaar!: (v: unknown) => void
    const fetchMock = vi.fn(() => new Promise((r) => { klaar = r }))
    vi.stubGlobal('fetch', fetchMock)
    gaNaar(`?s=${CODE}`)
    render(<App />)
    expect(screen.getByText('Labels laden…')).toBeInTheDocument()
    klaar({ ok: true, status: 200, json: () => Promise.resolve({ labels: [label({ orderId: '1234567' }), label({ name: 'Adrie Bakker', colli: 2 })] }) })

    fireEvent.click(await screen.findByText('Print alle labels (5 colli)'))
    expect(fetchMock).toHaveBeenCalledWith(`/.netlify/functions/aanmelding?s=${CODE}&soort=labels`)
    expect(printedHtml[0]).toContain('Order 1234567')
    expect(screen.getByText(/Adrie Bakker/)).toBeInTheDocument()
  })

  it('toont bij 404 dat de link verlopen is', async () => {
    vi.stubGlobal('fetch', antwoord(404, { error: 'verlopen' }))
    gaNaar(`?s=${CODE}`)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Deze printlink is verlopen (ouder dan 30 dagen) of bestaat niet.')
  })

  it('toont bij 403 dat de link alleen vanaf een goedgekeurd netwerk werkt', async () => {
    vi.stubGlobal('fetch', antwoord(403))
    gaNaar(`?s=${CODE}`)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Deze link werkt alleen vanaf een goedgekeurd netwerk.')
  })

  it('toont bij een andere fout een knop om opnieuw te proberen', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ labels: [label()] }) })
    vi.stubGlobal('fetch', fetchMock)
    gaNaar(`?s=${CODE}`)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Laden mislukt, probeer het opnieuw.')
    fireEvent.click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
    expect(await screen.findByText('Print alle labels (3 colli)')).toBeInTheDocument()
  })

  it('toont bij een netwerkfout hetzelfde foutscherm', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    gaNaar(`?s=${CODE}`)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Laden mislukt')
  })

  it('legacy ?printData= werkt zoals voorheen, zonder aanmelding op te halen', async () => {
    const entries: PrintEntry[] = [{ name: 'Oude Klant', adres: 'a', postcode: 'b', plaats: 'c', land: 'Nederland', route: 'Route 1', colli: 1, colliOmschrijvingen: [], spoed: false }]
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ orderIds: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    gaNaar(`?printData=${encodePrintData(entries)}&s=${CODE}`)
    render(<App />)
    expect(await screen.findByText(/Oude Klant/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes('/aanmelding'))).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toContain('/.netlify/functions/order-ids')
  })
})

describe('FotoPagina via ?fotos=', () => {
  const fotos: FotosAntwoord = {
    zendingen: [
      { nr: 1, naam: 'Jansen (Wageningen)', schap: 'Schap 3', fotos: [{ naam: 'a.jpg', data: 'data:image/jpeg;base64,AAA' }, { naam: 'b.jpg', data: 'data:image/jpeg;base64,BBB' }] },
      { nr: 2, naam: 'De Vries', schap: 'Overig: kar', fotos: [{ naam: 'c.jpg', data: 'data:image/jpeg;base64,CCC' }] },
    ],
  }

  it('laadt de foto\'s en groepeert ze per zending', async () => {
    const fetchMock = antwoord(200, fotos)
    vi.stubGlobal('fetch', fetchMock)
    gaNaar(`?fotos=${CODE}`)
    render(<App />)
    expect(screen.getByText('Foto\'s laden…')).toBeInTheDocument()
    const kop1 = await screen.findByRole('heading', { name: 'Jansen (Wageningen)' })
    expect(fetchMock).toHaveBeenCalledWith(`/.netlify/functions/aanmelding?s=${CODE}&soort=fotos`)
    const sectie1 = kop1.closest('section')!
    expect(within(sectie1).getByText('Schap 3')).toBeInTheDocument()
    expect(within(sectie1).getAllByRole('img')).toHaveLength(2)
    const sectie2 = screen.getByRole('heading', { name: 'De Vries' }).closest('section')!
    expect(within(sectie2).getByText('Overig: kar')).toBeInTheDocument()
    expect(within(sectie2).getAllByRole('img')).toHaveLength(1)
  })

  it('vraagt met &zending=n alleen die zending op', async () => {
    const fetchMock = antwoord(200, { zendingen: [fotos.zendingen[1]] })
    vi.stubGlobal('fetch', fetchMock)
    gaNaar(`?fotos=${CODE}&zending=2`)
    render(<App />)
    await screen.findByRole('heading', { name: 'De Vries' })
    expect(fetchMock).toHaveBeenCalledWith(`/.netlify/functions/aanmelding?s=${CODE}&soort=fotos&zending=2`)
  })

  it('opent een foto groot en sluit weer', async () => {
    vi.stubGlobal('fetch', antwoord(200, fotos))
    gaNaar(`?fotos=${CODE}`)
    render(<App />)
    fireEvent.click((await screen.findAllByAltText('a.jpg'))[0].closest('button')!)
    const venster = screen.getByRole('dialog')
    expect(within(venster).getByAltText('a.jpg')).toHaveAttribute('src', 'data:image/jpeg;base64,AAA')
    fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('toont de foutschermen bij 404, 403 en andere fouten', async () => {
    gaNaar(`?fotos=${CODE}`)
    vi.stubGlobal('fetch', antwoord(404))
    const a = render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('verlopen (ouder dan 30 dagen)')
    a.unmount()

    vi.stubGlobal('fetch', antwoord(403))
    const b = render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('goedgekeurd netwerk')
    b.unmount()

    vi.stubGlobal('fetch', antwoord(500))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Laden mislukt, probeer het opnieuw.')
    expect(screen.getByRole('button', { name: 'Opnieuw proberen' })).toBeInTheDocument()
  })
})
