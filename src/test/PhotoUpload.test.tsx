import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PhotoUpload from '../components/PhotoUpload'
import type { Photo } from '../types'

vi.mock('../photoUtils')

import { processFiles } from '../photoUtils'

const mockProcessFiles = vi.mocked(processFiles)

const mockPhoto: Photo = { id: '1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }

function makeInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

function triggerFileChange(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

describe('PhotoUpload', () => {
  beforeEach(() => {
    mockProcessFiles.mockReset()
  })

  it('renders upload button', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(screen.getByText("Foto's toevoegen (meerdere mogelijk)")).toBeInTheDocument()
  })

  it('shows no error by default', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows error when processFiles throws', async () => {
    mockProcessFiles.mockRejectedValueOnce(
      new Error('Alleen afbeeldingen zijn toegestaan. Niet toegestaan: document.pdf'),
    )

    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    triggerFileChange(makeInput(), [new File([''], 'document.pdf', { type: 'application/pdf' })])

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Alleen afbeeldingen zijn toegestaan')
    })
  })

  it('clears error on a subsequent valid upload', async () => {
    mockProcessFiles
      .mockRejectedValueOnce(new Error('Alleen afbeeldingen zijn toegestaan. Niet toegestaan: doc.pdf'))
      .mockResolvedValueOnce([mockPhoto])

    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    const input = makeInput()

    triggerFileChange(input, [new File([''], 'doc.pdf', { type: 'application/pdf' })])
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    triggerFileChange(input, [new File([''], 'foto.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('calls onChange with new photos on valid upload', async () => {
    mockProcessFiles.mockResolvedValueOnce([mockPhoto])
    const onChange = vi.fn()

    render(<PhotoUpload photos={[]} onChange={onChange} />)
    triggerFileChange(makeInput(), [new File([''], 'foto.jpg', { type: 'image/jpeg' })])

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  })

  it('renders photo thumbnails', () => {
    render(<PhotoUpload photos={[mockPhoto]} onChange={vi.fn()} />)
    expect(screen.getByAltText('foto.jpg')).toBeInTheDocument()
  })

  it('calls onChange to remove a photo when delete is clicked', () => {
    const onChange = vi.fn()
    render(<PhotoUpload photos={[mockPhoto]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Verwijder foto' }))
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('uploadknop heeft grijze stippellijn als invalid niet gezet is', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /foto's toevoegen/i })
    expect(btn.className).toContain('border-gray-200')
    expect(btn.className).not.toContain('border-red-400')
  })

  it('uploadknop heeft rode stippellijn als invalid=true', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} invalid />)
    const btn = screen.getByRole('button', { name: /foto's toevoegen/i })
    expect(btn.className).toContain('border-red-400')
    expect(btn.className).not.toContain('border-gray-200')
  })

  it('uploadknop heeft grijze stippellijn als invalid=false', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} invalid={false} />)
    const btn = screen.getByRole('button', { name: /foto's toevoegen/i })
    expect(btn.className).toContain('border-gray-200')
    expect(btn.className).not.toContain('border-red-400')
  })
})
