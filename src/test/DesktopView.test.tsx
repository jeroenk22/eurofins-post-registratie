import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import DesktopView from '../components/DesktopView'
import { useStore } from '../useStore'
import { submitToWebhook, resubmitToMake, SubmitError, type PendingSubmission } from '../webhookService'
import { printLabels } from '../services/printService'
import type { SubmitPayload } from '../types'

vi.mock('../webhookService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../webhookService')>()),
  submitToWebhook: vi.fn(),
  resubmitToMake: vi.fn(),
}))

vi.mock('../services/printService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/printService')>()),
  printLabels: vi.fn(),
}))

const VERZONDEN = '2026-09-24T09:22:31.000Z'
vi.mock('../services/serverTime', () => ({
  serverNow: () => new Date('2026-09-24T09:22:31.000Z'),
}))

const ENTRY = {
  id: 'e1', shelf: 3, shelfDescription: '', name: 'Jansen (Wageningen)',
  adres: 'Dorpsstraat 1', postcode: '6700AA', plaats: 'Wageningen', land: 'Nederland',
  colli: 2, colliOmschrijvingen: ['Doos', 'Koelbox'], recipientType: 'Monsternemers', spoed: false,
  photos: [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }],
}

function seed({ entry = true, afzender = true } = {}) {
  if (entry) {
    sessionStorage.setItem('form_draft', JSON.stringify({
      entries: [ENTRY], senderName: '', senderPhone: '', senderEmail: '', senderCcEmail: '',
    }))
  }
  if (afzender) {
    localStorage.setItem('afzender', JSON.stringify({
      senderName: 'Sophie', senderPhone: '', senderEmail: 'magazijn@eurofins.nl', senderCcEmail: '',
    }))
  }
}

function Harness() {
  const store = useStore()
  return <DesktopView store={store} recipients={[]} />
}

const CODE = 'abcdEFGH1234_-xy'

const verzend = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Verzenden/ })) })
}

describe('DesktopView', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(submitToWebhook).mockResolvedValue({ submittedAt: VERZONDEN, orderIds: ['1293793'], submissionId: CODE })
  })

  describe('instellingen', () => {
    it('staan open op een werkplek waar nog geen naam bekend is', () => {
      seed({ afzender: false })
      render(<Harness />)
      expect(screen.getByLabelText('Jouw naam *')).toBeInTheDocument()
    })

    it('zijn ingeklapt als de afzender bekend is, met een samenvatting', () => {
      seed()
      render(<Harness />)
      expect(screen.queryByLabelText('Jouw naam *')).not.toBeInTheDocument()
      expect(screen.getByText(/Sophie · magazijn@eurofins\.nl/)).toBeInTheDocument()
    })

    it('vragen in de balk om gegevens zolang er geen naam is', () => {
      seed({ afzender: false })
      render(<Harness />)
      expect(screen.getByRole('button', { name: 'Instellingen' })).toHaveTextContent('Vul eerst je gegevens in')
    })

    it('sluiten met Escape of een klik ernaast', () => {
      seed()
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Instellingen' }))
      expect(screen.getByLabelText('Jouw naam *')).toBeInTheDocument()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByLabelText('Jouw naam *')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Instellingen' }))
      fireEvent.mouseDown(screen.getByPlaceholderText(/bijv\. jan de vries/i))
      expect(screen.queryByLabelText('Jouw naam *')).not.toBeInTheDocument()
    })

    it('klappen open met een melding als de naam ontbreekt bij verzenden', async () => {
      seed({ afzender: false })
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Instellingen sluiten' }))
      await verzend()
      expect(screen.getByLabelText('Jouw naam *')).toHaveClass('!border-red-400')
      expect(screen.getByRole('alert')).toHaveTextContent('Vul je naam in')
      expect(submitToWebhook).not.toHaveBeenCalled()
    })
  })

  it('verstuurt niet als de zending onvolledig is', async () => {
    seed({ entry: false })
    render(<Harness />)
    await verzend()
    expect(screen.getByRole('alert')).toHaveTextContent('Selecteer bij elke zending een schap nummer')
    expect(submitToWebhook).not.toHaveBeenCalled()
  })

  describe('na verzenden', () => {
    it('verstuurt alleen deze zending, met de mail-instelling', async () => {
      seed()
      render(<Harness />)
      await verzend()
      expect(submitToWebhook).toHaveBeenCalledTimes(1)
      const [entries, naam, , email, , opties] = vi.mocked(submitToWebhook).mock.calls[0]
      expect(entries.map(e => e.id)).toEqual(['e1'])
      expect(naam).toBe('Sophie')
      expect(email).toBe('magazijn@eurofins.nl')
      expect(opties).toEqual({ mailVersturen: true })
    })

    it('staat de zending met ordernummer onder "Vandaag verzonden" en is het formulier leeg', async () => {
      seed()
      render(<Harness />)
      await verzend()
      const lijst = screen.getByRole('complementary', { name: 'Vandaag verzonden' })
      expect(within(lijst).getByText('Order 1293793')).toBeInTheDocument()
      expect(within(lijst).getByText('Jansen (Wageningen)')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/bijv\. jan de vries/i)).toHaveValue('')
      expect(JSON.parse(localStorage.getItem('verzonden_vandaag')!).items).toHaveLength(1)
    })

    it('bewaart de aanmeldingscode bij de verzonden zending', async () => {
      seed()
      render(<Harness />)
      await verzend()
      expect(JSON.parse(localStorage.getItem('verzonden_vandaag')!).items[0].submissionId).toBe(CODE)
    })

    it('print de labels mét order-ID (QR-code) vanuit de verzonden zending', async () => {
      seed()
      render(<Harness />)
      await verzend()
      fireEvent.click(screen.getByRole('button', { name: /Print 2 labels/ }))
      const [labels] = vi.mocked(printLabels).mock.calls[0]
      expect(labels).toEqual([expect.objectContaining({ name: 'Jansen (Wageningen)', orderId: '1293793', orderedAt: VERZONDEN, route: 'Route 3' })])
    })

    it('mailt het dagoverzicht via de functie, naar de afzender', async () => {
      seed()
      render(<Harness />)
      expect(screen.queryByText(/Dagoverzicht mailen/)).not.toBeInTheDocument()
      await verzend()
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
      vi.stubGlobal('fetch', fetchMock)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Dagoverzicht mailen/ })) })

      const [url, init] = fetchMock.mock.calls.find(([u]) => u === '/.netlify/functions/dagoverzicht')!
      expect(url).toBe('/.netlify/functions/dagoverzicht')
      const body = JSON.parse((init as RequestInit).body as string)
      expect(body.to).toBe('magazijn@eurofins.nl')
      expect(body.senderName).toBe('Sophie')
      expect(body.items).toEqual([expect.objectContaining({ orderId: '1293793', name: 'Jansen (Wageningen)', colli: 2, colliOmschrijvingen: ['Doos', 'Koelbox'] })])
      // De printlink in de mail krijgt de labels mét order-ID (QR-code).
      expect(body.labels).toEqual([expect.objectContaining({ name: 'Jansen (Wageningen)', orderId: '1293793', route: 'Route 3' })])
      expect(body.printData).toBeUndefined()
      expect(body.items[0]).toEqual(expect.objectContaining({ submissionId: CODE, fotoCount: 1 }))
      expect(screen.getByRole('status')).toHaveTextContent('Dagoverzicht verstuurd naar magazijn@eurofins.nl')
      vi.unstubAllGlobals()
    })

    it('toont het als het dagoverzicht niet verstuurd kon worden', async () => {
      seed()
      render(<Harness />)
      await verzend()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'Het dagoverzicht per mail is nog niet ingesteld.' }) }))
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Dagoverzicht mailen/ })) })
      expect(screen.getByRole('alert')).toHaveTextContent('nog niet ingesteld')
      vi.unstubAllGlobals()
    })

    it('geeft een verzonden spoedzending een oranje streep, de rest groen', () => {
      const label = (name: string, spoed: boolean) => ({
        name, adres: '', postcode: '', plaats: '', land: 'Nederland', route: 'Route 1',
        colli: 1, colliOmschrijvingen: [], spoed, orderedAt: VERZONDEN,
      })
      localStorage.setItem('verzonden_vandaag', JSON.stringify({ day: '2026-09-24', items: [
        { id: 'b', sentAt: VERZONDEN, orderId: '1', label: label('Met spoed', true) },
        { id: 'a', sentAt: VERZONDEN, orderId: '2', label: label('Gewoon', false) },
      ] }))
      seed()
      render(<Harness />)
      expect(screen.getByText('Met spoed').closest('li')).toHaveClass('!border-l-ef-orange')
      expect(screen.getByText('Gewoon').closest('li')).toHaveClass('!border-l-mi-green')
    })

    it('print alle labels van vandaag in één keer, oudste eerst', () => {
      const label = (orderId: string, colli: number) => ({
        name: 'X', adres: '', postcode: '', plaats: '', land: 'Nederland', route: 'Route 1',
        colli, colliOmschrijvingen: [], spoed: false, orderedAt: VERZONDEN, orderId,
      })
      localStorage.setItem('verzonden_vandaag', JSON.stringify({ day: '2026-09-24', items: [
        { id: 'b', sentAt: '2026-09-24T10:00:00.000Z', orderId: '1293800', label: label('1293800', 1) },
        { id: 'a', sentAt: VERZONDEN, orderId: '1293793', label: label('1293793', 2) },
      ] }))
      seed()
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: /Alle labels printen \(3\)/ }))
      const [labels] = vi.mocked(printLabels).mock.calls[0]
      expect(labels.map(l => l.orderId)).toEqual(['1293793', '1293800'])
    })

    it('toont alle gegevens van een verzonden zending in een venster', async () => {
      seed()
      render(<Harness />)
      await verzend()
      fireEvent.click(screen.getByRole('button', { name: 'Details van Jansen (Wageningen)' }))

      const venster = screen.getByRole('dialog', { name: 'Zending Jansen (Wageningen)' })
      expect(within(venster).getByText('Order 1293793')).toBeInTheDocument()
      expect(within(venster).getByText('Monsternemer')).toBeInTheDocument()
      expect(within(venster).getByText('Dorpsstraat 1')).toBeInTheDocument()
      expect(within(venster).getByText('6700AA Wageningen')).toBeInTheDocument()
      expect(within(venster).getByText('Schap 3')).toBeInTheDocument()
      expect(within(venster).getByText('Doos')).toBeInTheDocument()
      expect(within(venster).getByText('Koelbox')).toBeInTheDocument()
      expect(within(venster).getByText('Sophie')).toBeInTheDocument()
      expect(within(venster).getByText('magazijn@eurofins.nl')).toBeInTheDocument()

      fireEvent.click(within(venster).getByRole('button', { name: /Print 2 labels/ }))
      expect(vi.mocked(printLabels).mock.calls[0][0]).toEqual([expect.objectContaining({ orderId: '1293793' })])

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opent het venster ook bij een klik op de tegel, maar niet bij printen', async () => {
      seed()
      render(<Harness />)
      await verzend()
      const lijst = screen.getByRole('complementary', { name: 'Vandaag verzonden' })
      fireEvent.click(within(lijst).getByRole('button', { name: /Print 2 labels/ }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      fireEvent.click(within(lijst).getByText('Order 1293793'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('toont ook zendingen van vóór de extra gegevens', () => {
      localStorage.setItem('verzonden_vandaag', JSON.stringify({ day: '2026-09-24', items: [
        { id: 'a', sentAt: VERZONDEN, orderId: '7', label: {
          name: 'Oud', adres: '', postcode: '', plaats: '', land: '', route: 'Route 1',
          colli: 1, colliOmschrijvingen: [], spoed: true, orderedAt: VERZONDEN,
        } },
      ] }))
      seed()
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Details van Oud' }))
      const venster = screen.getByRole('dialog')
      expect(within(venster).getByText('Route 1')).toBeInTheDocument()
      expect(within(venster).getByText('SPOED')).toBeInTheDocument()
      expect(within(venster).queryByText('Aangemeld door')).not.toBeInTheDocument()
    })

    it('toont zonder ordernummer dat er geen QR-code op komt', async () => {
      vi.mocked(submitToWebhook).mockResolvedValue({ submittedAt: VERZONDEN, orderIds: [], submissionId: CODE })
      seed()
      render(<Harness />)
      await verzend()
      expect(screen.getByText('Geen ordernummer')).toHaveAttribute('title', expect.stringMatching(/geen QR-code/))
      fireEvent.click(screen.getByRole('button', { name: 'Details van Jansen (Wageningen)' }))
      expect(within(screen.getByRole('dialog')).getByText(/geen QR-code/)).toBeInTheDocument()
    })
  })

  it('stuurt mail_versturen=false als de mail per zending uit staat', async () => {
    seed()
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Instellingen' }))
    fireEvent.click(screen.getByLabelText(/Bevestigingsmail bij elke verzonden zending/))
    await verzend()
    expect(vi.mocked(submitToWebhook).mock.calls[0][5]).toEqual({ mailVersturen: false })
    expect(localStorage.getItem('mail_per_zending')).toBe('uit')
  })

  it('verstuurt niet twee keer bij dubbelklikken', async () => {
    let klaar: (v: { submittedAt: string; orderIds: string[]; submissionId: string }) => void = () => {}
    vi.mocked(submitToWebhook).mockReturnValue(new Promise(r => { klaar = r }))
    seed()
    render(<Harness />)
    const knop = screen.getByRole('button', { name: /Verzenden/ })
    fireEvent.click(knop)
    fireEvent.click(knop)
    expect(knop).toBeDisabled()
    await act(async () => { klaar({ submittedAt: VERZONDEN, orderIds: ['1293793'], submissionId: CODE }) })
    expect(submitToWebhook).toHaveBeenCalledTimes(1)
  })

  it('maakt geen tweede order als Make faalde terwijl de order al bestond', async () => {
    const pending: PendingSubmission = { payload: { submitted_at: VERZONDEN } as SubmitPayload, orderIds: ['1293793'] }
    vi.mocked(submitToWebhook).mockRejectedValueOnce(new SubmitError('HTTP 500', pending))
    vi.mocked(resubmitToMake).mockResolvedValue({ submittedAt: VERZONDEN, orderIds: ['1293793'], submissionId: CODE })
    seed()
    render(<Harness />)

    await verzend()
    expect(screen.getByRole('alert')).toHaveTextContent('er komt geen tweede order')

    await verzend()
    expect(submitToWebhook).toHaveBeenCalledTimes(1)
    expect(resubmitToMake).toHaveBeenCalledWith(expect.objectContaining({ orderIds: ['1293793'], entryId: 'e1' }))
    expect(screen.getByText('Order 1293793')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('verzonden_vandaag')!).items[0].submissionId).toBe(CODE)
    expect(sessionStorage.getItem('submit_pending')).toBeNull()
  })

  it('toont eerder vandaag verzonden zendingen weer na herladen', async () => {
    seed()
    const { unmount } = render(<Harness />)
    await verzend()
    unmount()
    render(<Harness />)
    expect(screen.getByText('Order 1293793')).toBeInTheDocument()
  })
})
