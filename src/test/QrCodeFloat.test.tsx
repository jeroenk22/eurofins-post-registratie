import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import QrCodeFloat from '../components/QrCodeFloat'
import type { PostEntry } from '../types'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fakeqr'),
  },
}))

function makeEntry(overrides: Partial<PostEntry> = {}): PostEntry {
  return {
    id: 'e1', shelf: 1, shelfDescription: '', name: '', adres: '',
    postcode: '', plaats: '', land: '', colli: 1, spoed: false, photos: [],
    ...overrides,
  }
}

describe('QrCodeFloat', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rendert niet als geen enkele entry via autocomplete geselecteerd is', () => {
    // naam getypt maar geen adres → nog niet via dropdown geselecteerd
    const entries = [makeEntry({ name: 'Kees Hin', adres: '' })]
    const { container } = render(
      <QrCodeFloat sessionId="s1" entries={entries} syncedEntryIds={new Set()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('rendert niet als er helemaal geen entries zijn', () => {
    const { container } = render(
      <QrCodeFloat sessionId="s1" entries={[]} syncedEntryIds={new Set()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('rendert het paneel als minstens één ontvanger geselecteerd is (naam + adres)', async () => {
    const entries = [makeEntry({ name: 'Kees Hin', adres: 'Kerkstraat 1' })]
    render(<QrCodeFloat sessionId="s1" entries={entries} syncedEntryIds={new Set()} />)
    expect(await screen.findByText("Foto's via mobiel")).toBeInTheDocument()
    expect(screen.getByText('Kees Hin')).toBeInTheDocument()
  })

  it('heeft hidden md:block class zodat het verborgen is op mobiel', async () => {
    const entries = [makeEntry({ name: 'Kees Hin', adres: 'Kerkstraat 1' })]
    const { container } = render(
      <QrCodeFloat sessionId="s1" entries={entries} syncedEntryIds={new Set()} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('hidden')
    expect(wrapper.className).toContain('md:block')
  })

  it('toont ✓ voor entries waarvan foto gesynchroniseerd is', async () => {
    const entries = [makeEntry({ id: 'e1', name: 'Kees Hin', adres: 'Kerkstraat 1' })]
    render(
      <QrCodeFloat sessionId="s1" entries={entries} syncedEntryIds={new Set(['e1'])} />
    )
    expect(await screen.findByText('✓')).toBeInTheDocument()
  })

  it('pusht entries naar session endpoint bij render', async () => {
    const entries = [makeEntry({ name: 'Kees Hin', adres: 'Kerkstraat 1' })]
    render(<QrCodeFloat sessionId="s1" entries={entries} syncedEntryIds={new Set()} />)
    await screen.findByText("Foto's via mobiel")
    expect(fetch).toHaveBeenCalledWith(
      '/.netlify/functions/session',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
