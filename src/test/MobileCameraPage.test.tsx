import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MobileCameraPage from '../components/MobileCameraPage'

vi.mock('../photoUtils', () => ({
  processFiles: vi.fn().mockResolvedValue([
    { id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' },
  ]),
}))

const mockSession = {
  entries: [
    { id: 'e1', name: 'Kees Hin' },
    { id: 'e2', name: 'Wim Scholten' },
  ],
}

describe('MobileCameraPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
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

  it('toont successcherm na uploaden', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSession } as Response)
      .mockResolvedValue({ ok: true } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')

    fireEvent.click(screen.getByText("📤 Foto's uploaden"))
    expect(await screen.findByText("Foto's geüpload!")).toBeInTheDocument()
  })

  it('POST naar session endpoint per entry bij uploaden', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSession } as Response)
      .mockResolvedValue({ ok: true } as Response)

    render(<MobileCameraPage sessionId="test-session" />)
    await screen.findByText('Kees Hin')

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
})
