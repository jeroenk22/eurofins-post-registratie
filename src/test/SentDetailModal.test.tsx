import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SentDetailModal from '../components/SentDetailModal'
import type { SentItem } from '../services/sentToday'

vi.mock('../services/aanmelding', () => ({ fetchFotos: vi.fn() }))
vi.mock('../services/printService', () => ({ getSelectedFormat: vi.fn(), printLabels: vi.fn() }))

import { fetchFotos } from '../services/aanmelding'

const CODE = 'abcdefghijklmnop'

function item(photoCount: number): SentItem {
  return {
    id: 'x',
    sentAt: '2026-10-12T12:32:00.000Z',
    orderId: '1302143',
    submissionId: CODE,
    label: {
      name: 'FD41 - Ferdi Koldeweij (Winterswijk)', adres: 'Beerninkweg 1', postcode: '7104 GJ', plaats: 'Winterswijk',
      route: 'Route 1', colli: 1, colliOmschrijvingen: ['Doos'], spoed: false, land: 'Nederland',
    },
    details: {
      schap: 'Schap 1', recipientType: 'Monsternemers', photoCount,
      senderName: 'Jeroen', senderPhone: '', senderEmail: '', senderCcEmail: '', mailVerstuurd: false,
    },
  }
}

const fotos = (n: number) => ({
  zendingen: [{
    nr: 1, naam: 'FD41', schap: 'Schap 1',
    fotos: Array.from({ length: n }, (_, i) => ({ naam: `foto_${i + 1}.jpg`, data: `data:image/jpeg;base64,${i}` })),
  }],
})

describe('SentDetailModal — foto\'s', () => {
  beforeEach(() => vi.mocked(fetchFotos).mockReset())

  it('toont tijdens het laden net zoveel vakjes als er foto\'s zijn, daarna de miniaturen', async () => {
    let klaar!: (v: ReturnType<typeof fotos>) => void
    vi.mocked(fetchFotos).mockReturnValue(new Promise(r => { klaar = r }))
    render(<SentDetailModal item={item(3)} onClose={vi.fn()} />)

    expect(fetchFotos).toHaveBeenCalledWith(CODE, 1)
    expect(screen.getByLabelText("Foto's laden").children).toHaveLength(3)

    klaar(fotos(3))
    expect(await screen.findByRole('button', { name: 'Foto 1 groot bekijken' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /groot bekijken/ })).toHaveLength(3)
  })

  it('opent een foto groot, bladert met vorige/volgende en heeft geen verwijderknop', async () => {
    vi.mocked(fetchFotos).mockResolvedValue(fotos(3))
    render(<SentDetailModal item={item(3)} onClose={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Foto 2 groot bekijken' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volgende foto' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volgende foto' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    expect(screen.queryByText(/Verwijder foto/)).not.toBeInTheDocument()
  })

  it('Escape sluit eerst alleen de grote foto, daarna het venster', async () => {
    vi.mocked(fetchFotos).mockResolvedValue(fotos(2))
    const onClose = vi.fn()
    render(<SentDetailModal item={item(2)} onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Foto 1 groot bekijken' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('een klik naast de grote foto sluit alleen de foto', async () => {
    vi.mocked(fetchFotos).mockResolvedValue(fotos(2))
    const onClose = vi.fn()
    render(<SentDetailModal item={item(2)} onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Foto 1 groot bekijken' }))
    fireEvent.click(screen.getByRole('dialog', { name: 'Foto bekijken' }))
    expect(screen.queryByRole('dialog', { name: 'Foto bekijken' })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('haalt niets op zonder foto\'s of zonder aanmeldingscode', () => {
    const { unmount } = render(<SentDetailModal item={item(0)} onClose={vi.fn()} />)
    expect(screen.getByText('Geen')).toBeInTheDocument()
    unmount()
    render(<SentDetailModal item={{ ...item(4), submissionId: undefined }} onClose={vi.fn()} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(fetchFotos).not.toHaveBeenCalled()
  })

  it('meldt het als de foto\'s niet geladen kunnen worden of verlopen zijn', async () => {
    vi.mocked(fetchFotos).mockRejectedValueOnce(new Error('netwerk'))
    const { unmount } = render(<SentDetailModal item={item(2)} onClose={vi.fn()} />)
    expect(await screen.findByText('(konden niet geladen worden)')).toBeInTheDocument()
    unmount()

    vi.mocked(fetchFotos).mockResolvedValueOnce({ zendingen: [] })
    render(<SentDetailModal item={item(2)} onClose={vi.fn()} />)
    expect(await screen.findByText('(niet meer beschikbaar)')).toBeInTheDocument()
  })
})
