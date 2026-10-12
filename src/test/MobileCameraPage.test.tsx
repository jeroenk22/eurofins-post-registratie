import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MobileCameraPage from '../components/MobileCameraPage'
import { loadPhotos, savePhotos } from '../photoStorage'

vi.mock('../photoUtils', () => ({
  processFiles: vi.fn().mockResolvedValue([
    { id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' },
  ]),
}))

vi.mock('../photoStorage', () => ({
  loadPhotos: vi.fn().mockResolvedValue({}),
  savePhotos: vi.fn().mockResolvedValue(undefined),
  clearPhotos: vi.fn().mockResolvedValue(undefined),
}))

const mockSession = {
  entries: [
    { id: 'e1', name: 'Kees Hin', colli: 1, desktopPhotoCount: 0 },
    { id: 'e2', name: 'Wim Scholten', colli: 2, desktopPhotoCount: 0 },
  ],
}

const mockSessionWithDesktopPhotos = {
  entries: [
    { id: 'e1', name: 'Kees Hin', colli: 1, desktopPhotoCount: 2 },
    { id: 'e2', name: 'Wim Scholten', colli: 1, desktopPhotoCount: 0 },
  ],
}

describe('MobileCameraPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('toont laadstatus initieel', () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    expect(screen.getByText('Laden…')).toBeInTheDocument()
  })

  it('toont entries na succesvol laden', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    expect(await screen.findByText('Kees Hin')).toBeInTheDocument()
    expect(screen.getByText('Wim Scholten')).toBeInTheDocument()
  })

  it('biedt per zending een camera- en een galerijknop', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')

    const camera = screen.getAllByText('Foto maken')[0].closest('label')!.querySelector('input')!
    const galerij = screen.getAllByText('Kies uit galerij')[0].closest('label')!.querySelector('input')!
    // Met `capture` opent de telefoon direct de camera; zonder kies je bestaande foto's
    expect(camera).toHaveAttribute('capture', 'environment')
    expect(galerij).not.toHaveAttribute('capture')
    expect(galerij).toHaveAttribute('multiple')
  })

  it('meldt een verloren camerafoto als de pagina herlaadde terwijl de camera open was', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockSession } as Response)
    // Zoals achtergelaten door de vorige (door Android afgesloten) pagina
    sessionStorage.setItem('camera-open-test-session', 'e2')
    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Wim Scholten')

    expect(screen.getByText(/pagina opnieuw geladen terwijl de camera openstond/)).toBeInTheDocument()
    expect(sessionStorage.getItem('camera-open-test-session')).toBeNull()

    fireEvent.change(screen.getAllByText('Kies uit galerij')[1].closest('label')!.querySelector('input')!, {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })
    await screen.findByText('×')
    expect(screen.queryByText(/pagina opnieuw geladen/)).not.toBeInTheDocument()
  })

  it('onthoudt dat de camera open staat zolang je weg bent', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockSession } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Wim Scholten')

    expect(screen.queryByText(/pagina opnieuw geladen/)).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Foto maken')[1].closest('label')!.querySelector('input')!)
    expect(sessionStorage.getItem('camera-open-test-session')).toBe('e2')

    // Terug in de browser zonder herladen (bijv. geannuleerd): vlag weg
    document.dispatchEvent(new Event('visibilitychange'))
    expect(sessionStorage.getItem('camera-open-test-session')).toBeNull()
  })

  it('wisselt een foto naar screenshot met een tik op het label, en bewaart dat', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockSession } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')
    fireEvent.change(screen.getAllByText('Kies uit galerij')[0].closest('label')!.querySelector('input')!, {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })

    fireEvent.click(await screen.findByText('foto'))

    expect(screen.getByText('screenshot')).toBeInTheDocument()
    expect(vi.mocked(savePhotos)).toHaveBeenLastCalledWith('test-session', {
      e1: [expect.objectContaining({ id: 'p1', soort: 'screenshot' })],
    })
  })

  it('toont foutmelding als sessie niet gevonden wordt (404)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    render(<MobileCameraPage sessionId="onbekend" />)
    expect(await screen.findByText(/Sessie niet gevonden/)).toBeInTheDocument()
  })

  it('blokkeert uploaden zonder foto als desktopPhotoCount 0 is', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')

    fireEvent.click(screen.getByText("📤 Foto's uploaden"))
    expect(await screen.findByText(/Voeg minimaal 1 foto toe voor/)).toBeInTheDocument()
    expect(screen.queryByText("Foto's geüpload!")).not.toBeInTheDocument()
  })

  it('toont melding als entry al desktop-fotos heeft', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSessionWithDesktopPhotos,
    } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')
    expect(screen.getByText(/Reeds 2 foto's geüpload via desktop/)).toBeInTheDocument()
  })

  it('toont successcherm na uploaden als entry desktop-fotos heeft', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSessionWithDesktopPhotos } as Response)
      .mockResolvedValue({ ok: true } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')

    // e1 heeft desktopPhotoCount=2 (optioneel), e2 heeft 0 → moet foto krijgen
    const inputs = screen.getAllByText('Kies uit galerij')
    fireEvent.change(inputs[1].closest('label')!.querySelector('input')!, {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })
    await screen.findByText('×') // foto preview verschijnt

    fireEvent.click(screen.getByText("📤 Foto's uploaden"))
    expect(await screen.findByText("Foto's geüpload!")).toBeInTheDocument()
  })

  it('uploadt de zendingen na elkaar, niet tegelijk', async () => {
    let eersteKlaar!: (r: Response) => void
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      if ((init as RequestInit)?.method !== 'POST') return { ok: true, json: async () => mockSessionWithDesktopPhotos } as Response
      const posts = vi.mocked(fetch).mock.calls.filter(([, i]) => (i as RequestInit)?.method === 'POST').length
      if (posts === 1) return new Promise<Response>(resolve => { eersteKlaar = resolve })
      return { ok: true } as Response
    })
    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')
    fireEvent.change(screen.getAllByText("Foto's toevoegen (meerdere mogelijk)")[1].closest('label')!.querySelector('input')!, {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })
    await screen.findByText('×')

    fireEvent.click(screen.getByText("📤 Foto's uploaden"))
    const aantalPosts = () => vi.mocked(fetch).mock.calls.filter(([, i]) => (i as RequestInit)?.method === 'POST').length
    await waitFor(() => expect(aantalPosts()).toBe(1))
    await new Promise(r => setTimeout(r, 20))
    expect(aantalPosts()).toBe(1) // de tweede wacht op de eerste

    eersteKlaar({ ok: true } as Response)
    expect(await screen.findByText("Foto's geüpload!")).toBeInTheDocument()
    expect(aantalPosts()).toBe(2)
  })

  it('POST naar session endpoint per entry bij uploaden', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSessionWithDesktopPhotos } as Response)
      .mockResolvedValue({ ok: true } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')

    // Voeg foto toe aan e2 (desktopPhotoCount=0)
    const inputs = screen.getAllByText('Kies uit galerij')
    fireEvent.change(inputs[1].closest('label')!.querySelector('input')!, {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })
    await screen.findByText('×')

    fireEvent.click(screen.getByText("📤 Foto's uploaden"))
    await screen.findByText("Foto's geüpload!")

    const postCalls = vi.mocked(fetch).mock.calls.filter(
      ([, init]) => (init as RequestInit)?.method === 'POST',
    )
    expect(postCalls).toHaveLength(2) // één per entry
    const bodies = postCalls.map(([, init]) => JSON.parse((init as RequestInit).body as string))
    expect(bodies[0].entryId).toBe('e1')
    expect(bodies[1].entryId).toBe('e2')
  })

  it('herstelt successtatus na refresh via sessionStorage', () => {
    sessionStorage.setItem('submitted-test-session', '1')
    render(<MobileCameraPage sessionId="test-session" />)
    expect(screen.getByText("Foto's geüpload!")).toBeInTheDocument()
  })

  it('slaat verwijdering direct op zodat foto niet terugkomt na refresh', async () => {
    // Simuleer een opgeslagen foto (alsof een eerdere sessie deze had opgeslagen)
    vi.mocked(loadPhotos).mockResolvedValue({
      e1: [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }],
    })
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockSession } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    // Wacht tot foto geladen is vanuit storage
    expect(await screen.findByAltText('foto.jpg')).toBeInTheDocument()

    // Verwijder de foto
    fireEvent.click(screen.getByLabelText('Verwijder foto'))

    // savePhotos moet zijn aangeroepen met een lege array voor e1
    await waitFor(() => {
      const calls = vi.mocked(savePhotos).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).toMatchObject({ e1: [] })
    })
  })

  it('herstelt foto\'s na accidentele refresh als gebruiker ze niet heeft verwijderd', async () => {
    vi.mocked(loadPhotos).mockResolvedValue({
      e1: [{ id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }],
    })
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => mockSession } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    expect(await screen.findByAltText('foto.jpg')).toBeInTheDocument()
  })

  it('haalt de lijst opnieuw op als het scherm weer actief wordt', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSession } as Response)
      .mockResolvedValue({ ok: true, json: async () => ({ entries: [mockSession.entries[0]] }) } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Wim Scholten')

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(screen.queryByText('Wim Scholten')).not.toBeInTheDocument())
    expect(screen.getByText('Kees Hin')).toBeInTheDocument()
  })

  it('uploadt niet voor een zending die op de desktop al verzonden is', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSession } as Response)
      // controle vlak voor het uploaden: Wim Scholten is intussen verzonden
      .mockResolvedValue({ ok: true, json: async () => ({ entries: [mockSession.entries[0]] }) } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Wim Scholten')
    const inputs = screen.getAllByText('Kies uit galerij')
    fireEvent.change(inputs[1].closest('label')!.querySelector('input')!, {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })
    await screen.findByText('×')

    fireEvent.click(screen.getByText("📤 Foto's uploaden"))

    expect(await screen.findByText(/Al verzonden op de desktop: Wim Scholten/)).toBeInTheDocument()
    const postCalls = vi.mocked(fetch).mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'POST')
    expect(postCalls).toHaveLength(0)
    expect(screen.queryByText('Wim Scholten')).not.toBeInTheDocument()
  })

  it('toont een melding als er geen open zendingen zijn', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ entries: [] }) } as Response)
    render(<MobileCameraPage sessionId="test-session" />)
    expect(await screen.findByText(/geen open zendingen/)).toBeInTheDocument()
  })
})
