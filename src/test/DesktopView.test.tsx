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

const verzend = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Verzenden/ })) })
}

describe('DesktopView', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(submitToWebhook).mockResolvedValue({ submittedAt: VERZONDEN, orderIds: ['1293793'] })
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

    it('klappen open met een melding als de naam ontbreekt bij verzenden', async () => {
      seed({ afzender: false })
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: /Inklappen/ }))
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

    it('print de labels mét order-ID (QR-code) vanuit de verzonden zending', async () => {
      seed()
      render(<Harness />)
      await verzend()
      fireEvent.click(screen.getByRole('button', { name: /Print 2 labels/ }))
      const [labels] = vi.mocked(printLabels).mock.calls[0]
      expect(labels).toEqual([expect.objectContaining({ name: 'Jansen (Wageningen)', orderId: '1293793', orderedAt: VERZONDEN, route: 'Route 3' })])
    })

    it('biedt het dagoverzicht als mail aan', async () => {
      seed()
      render(<Harness />)
      expect(screen.queryByText(/Dagoverzicht mailen/)).not.toBeInTheDocument()
      await verzend()
      expect(screen.getByText(/Dagoverzicht mailen/).closest('a')).toHaveAttribute('href', expect.stringMatching(/^mailto:magazijn%40eurofins\.nl\?/))
    })

    it('toont zonder ordernummer dat er geen QR-code op komt', async () => {
      vi.mocked(submitToWebhook).mockResolvedValue({ submittedAt: VERZONDEN, orderIds: [] })
      seed()
      render(<Harness />)
      await verzend()
      expect(screen.getByText('Geen ordernummer')).toBeInTheDocument()
      expect(screen.getByText(/geen QR-code/)).toBeInTheDocument()
    })
  })

  it('stuurt mail_versturen=false als de mail per zending uit staat', async () => {
    seed()
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Wijzigen/ }))
    fireEvent.click(screen.getByLabelText(/Bevestigingsmail bij elke verzonden zending/))
    await verzend()
    expect(vi.mocked(submitToWebhook).mock.calls[0][5]).toEqual({ mailVersturen: false })
    expect(localStorage.getItem('mail_per_zending')).toBe('uit')
  })

  it('verstuurt niet twee keer bij dubbelklikken', async () => {
    let klaar: (v: { submittedAt: string; orderIds: string[] }) => void = () => {}
    vi.mocked(submitToWebhook).mockReturnValue(new Promise(r => { klaar = r }))
    seed()
    render(<Harness />)
    const knop = screen.getByRole('button', { name: /Verzenden/ })
    fireEvent.click(knop)
    fireEvent.click(knop)
    expect(knop).toBeDisabled()
    await act(async () => { klaar({ submittedAt: VERZONDEN, orderIds: ['1293793'] }) })
    expect(submitToWebhook).toHaveBeenCalledTimes(1)
  })

  it('maakt geen tweede order als Make faalde terwijl de order al bestond', async () => {
    const pending: PendingSubmission = { payload: { submitted_at: VERZONDEN } as SubmitPayload, orderIds: ['1293793'] }
    vi.mocked(submitToWebhook).mockRejectedValueOnce(new SubmitError('HTTP 500', pending))
    vi.mocked(resubmitToMake).mockResolvedValue({ submittedAt: VERZONDEN, orderIds: ['1293793'] })
    seed()
    render(<Harness />)

    await verzend()
    expect(screen.getByRole('alert')).toHaveTextContent('er komt geen tweede order')

    await verzend()
    expect(submitToWebhook).toHaveBeenCalledTimes(1)
    expect(resubmitToMake).toHaveBeenCalledWith(expect.objectContaining({ orderIds: ['1293793'], entryId: 'e1' }))
    expect(screen.getByText('Order 1293793')).toBeInTheDocument()
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
