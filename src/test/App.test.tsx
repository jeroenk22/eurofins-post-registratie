import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import App from '../App'

vi.mock('../webhookService', () => ({
  isWebhookConfigured: vi.fn(() => true),
  submitToWebhook: vi.fn(() => Promise.resolve()),
}))

vi.mock('../hooks/useRecipientData', () => ({
  useRecipientData: vi.fn(() => ({ recipients: [] })),
}))

vi.mock('../components/PwaInstallBanner', () => ({
  default: () => null,
}))

vi.mock('../components/MobileCameraPage', () => ({
  default: ({ sessionId }: { sessionId: string }) => (
    <div>MobileCameraPage:{sessionId}</div>
  ),
}))

vi.mock('../components/QrCodeFloat', () => ({
  default: () => null,
}))

const SUBMIT_STATE_KEY = 'submit_state'
const FORM_DRAFT_KEY = 'form_draft'

const draftWithEntry = JSON.stringify({
  entries: [{
    id: 'e1', shelf: 2, shelfDescription: '', name: 'Acme B.V.',
    adres: 'Kerkstraat 1', postcode: '1234AB', plaats: 'Zevenbergen',
    land: 'Nederland', colli: 1, spoed: false, photos: [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }],
  }],
  senderName: 'Sophie',
  senderPhone: '',
  senderEmail: 'sophie@example.com',
})


describe('App — submit_state persistentie', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('toont formulier als er geen submit_state in sessionStorage is', () => {
    render(<App />)
    expect(screen.getByText('📤 Versturen')).toBeInTheDocument()
    expect(screen.queryByText('Verstuurd!')).not.toBeInTheDocument()
  })

  it('toont SuccessScreen als submit_state = "success" bij laden (refresh-scenario)', () => {
    sessionStorage.setItem(SUBMIT_STATE_KEY, 'success')
    sessionStorage.setItem(FORM_DRAFT_KEY, draftWithEntry)
    render(<App />)
    expect(screen.getByText('Verstuurd!')).toBeInTheDocument()
    expect(screen.queryByText('📤 Versturen')).not.toBeInTheDocument()
  })

  it('verwijdert submit_state uit sessionStorage na reset', () => {
    sessionStorage.setItem(SUBMIT_STATE_KEY, 'success')
    sessionStorage.setItem(FORM_DRAFT_KEY, draftWithEntry)
    render(<App />)

    fireEvent.click(screen.getByText('+ Nieuwe aanmelding'))

    expect(sessionStorage.getItem(SUBMIT_STATE_KEY)).toBeNull()
  })

  it('slaat submit_state = "success" op in sessionStorage na succesvol verzenden', async () => {
    sessionStorage.setItem(FORM_DRAFT_KEY, draftWithEntry)
    render(<App />)

    await act(async () => {
      fireEvent.click(screen.getByText('📤 Versturen'))
    })

    expect(sessionStorage.getItem(SUBMIT_STATE_KEY)).toBe('success')
    expect(screen.getByText('Verstuurd!')).toBeInTheDocument()
  })
})
