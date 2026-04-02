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
    land: 'Nederland', colli: 1, colliOmschrijvingen: ['Test omschrijving'], spoed: false, photos: [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }],
  }],
  senderName: 'Sophie',
  senderPhone: '',
  senderEmail: 'sophie@example.com',
})


describe('App — versienummer', () => {
  beforeEach(() => sessionStorage.clear())

  it('toont een versienummer onder de verstuurknop', () => {
    render(<App />)
    expect(screen.getByText(/^v.+/)).toBeInTheDocument()
  })
})

describe('App — validatie: nieuwe entry toont geen rode velden', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('nieuwe entry na mislukte submit heeft geen rode velden', async () => {
    render(<App />)

    // Probeer te verzenden zonder iets in te vullen → validatiefout
    await act(async () => {
      fireEvent.click(screen.getByText('📤 Versturen'))
    })

    // Er moeten nu rode velden zijn in de eerste (lege) entry
    const nameInputsBefore = screen.getAllByPlaceholderText(/bijv\. jan de vries/i)
    expect(nameInputsBefore[0].className).toContain('border-red-400')

    // Voeg een nieuwe zending toe
    fireEvent.click(screen.getByText('Nog een zending toevoegen'))

    // De tweede (nieuwe) entry mag geen rode velden hebben
    const nameInputsAfter = screen.getAllByPlaceholderText(/bijv\. jan de vries/i)
    expect(nameInputsAfter).toHaveLength(2)
    expect(nameInputsAfter[1].className).not.toContain('border-red-400')
  })
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
