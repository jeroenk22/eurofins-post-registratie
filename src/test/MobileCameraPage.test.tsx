import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MobileCameraPage from '../components/MobileCameraPage'

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
    const inputs = screen.getAllByText('Foto\'s toevoegen (meerdere mogelijk)')
    fireEvent.change(inputs[1].closest('label')!.querySelector('input')!, {
      target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })] },
    })
    await screen.findByText('×') // foto preview verschijnt

    fireEvent.click(screen.getByText("📤 Foto's uploaden"))
    expect(await screen.findByText("Foto's geüpload!")).toBeInTheDocument()
  })

  it('POST naar session endpoint per entry bij uploaden', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSessionWithDesktopPhotos } as Response)
      .mockResolvedValue({ ok: true } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')

    // Voeg foto toe aan e2 (desktopPhotoCount=0)
    const inputs = screen.getAllByText('Foto\'s toevoegen (meerdere mogelijk)')
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
})
