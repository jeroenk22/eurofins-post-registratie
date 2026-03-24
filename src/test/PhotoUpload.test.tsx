import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PhotoUpload from '../components/PhotoUpload'
import type { Photo } from '../types'

vi.mock('../photoUtils')

import { validateImageFiles, resizeAndEncode } from '../photoUtils'

const mockValidate = vi.mocked(validateImageFiles)
const mockResize = vi.mocked(resizeAndEncode)

const mockPhoto: Photo = { id: '1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }
const mockPhoto2: Photo = { id: '2', name: 'screen2.png', data: 'data:image/png;base64,xyz' }

function makeInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

function triggerFileChange(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

function getPasteZone() {
  // The desktop paste zone has tabIndex=0 and role is implicit (div)
  return document.querySelector('[tabindex="0"]') as HTMLElement
}

function triggerPaste(target: HTMLElement, imageFiles: File[]) {
  const items = imageFiles.map(f => ({
    type: f.type,
    getAsFile: () => f,
  }))
  fireEvent.paste(target, { clipboardData: { items } })
}

describe('PhotoUpload — basis rendering', () => {
  beforeEach(() => {
    mockValidate.mockReset()
    mockResize.mockReset()
  })

  it('toont mobiele upload-knop', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(screen.getByText("Foto's toevoegen (meerdere mogelijk)")).toBeInTheDocument()
  })

  it('toont desktop paste-zone met Ctrl+V hint', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(screen.getByText(/ctrl\+v/i)).toBeInTheDocument()
  })

  it('toont upload-icoontje in desktop paste-zone', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Bestand uploaden' })).toBeInTheDocument()
  })

  it('toont geen fout bij initieel laden', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('toont foto-miniaturen als photos gevuld is', () => {
    render(<PhotoUpload photos={[mockPhoto]} onChange={vi.fn()} />)
    expect(screen.getByAltText('foto.jpg')).toBeInTheDocument()
  })

  it('verwijderknop roept onChange aan', () => {
    const onChange = vi.fn()
    render(<PhotoUpload photos={[mockPhoto]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Verwijder foto' }))
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('PhotoUpload — mobiele upload (file input)', () => {
  beforeEach(() => {
    mockValidate.mockReset()
    mockResize.mockReset()
  })

  it('voegt foto toe via file input', async () => {
    mockResize.mockResolvedValueOnce(mockPhoto)
    const onChange = vi.fn()
    render(<PhotoUpload photos={[]} onChange={onChange} />)
    triggerFileChange(makeInput(), [new File([''], 'foto.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  })

  it('toont fout bij ongeldig bestandstype', async () => {
    mockValidate.mockImplementationOnce(() => {
      throw new Error('Alleen afbeeldingen zijn toegestaan. Niet toegestaan: document.pdf')
    })
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    triggerFileChange(makeInput(), [new File([''], 'document.pdf', { type: 'application/pdf' })])
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Alleen afbeeldingen zijn toegestaan')
    })
  })

  it('wist fout na geldige upload', async () => {
    mockValidate
      .mockImplementationOnce(() => { throw new Error('fout') })
      .mockImplementation(() => undefined)
    mockResize.mockResolvedValueOnce(mockPhoto)
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    const input = makeInput()

    triggerFileChange(input, [new File([''], 'doc.pdf', { type: 'application/pdf' })])
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    triggerFileChange(input, [new File([''], 'foto.jpg', { type: 'image/jpeg' })])
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

describe('PhotoUpload — desktop paste (Ctrl+V)', () => {
  beforeEach(() => {
    mockValidate.mockReset()
    mockResize.mockReset()
  })

  it('paste-zone heeft tabIndex=0 zodat hij focusbaar is', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(getPasteZone()).not.toBeNull()
    expect(getPasteZone().tabIndex).toBe(0)
  })

  it('voegt foto toe bij plakken van afbeelding', async () => {
    mockResize.mockResolvedValueOnce(mockPhoto)
    const onChange = vi.fn()
    render(<PhotoUpload photos={[]} onChange={onChange} />)
    triggerPaste(getPasteZone(), [new File([''], 'screenshot.png', { type: 'image/png' })])
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  })

  it('negeert paste zonder afbeelding (bijv. tekst)', async () => {
    const onChange = vi.fn()
    render(<PhotoUpload photos={[]} onChange={onChange} />)
    fireEvent.paste(getPasteZone(), {
      clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] },
    })
    await waitFor(() => expect(onChange).not.toHaveBeenCalled())
  })

  it('negeert paste-items waarvan getAsFile() null geeft', async () => {
    const onChange = vi.fn()
    render(<PhotoUpload photos={[]} onChange={onChange} />)
    fireEvent.paste(getPasteZone(), {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => null }] },
    })
    await waitFor(() => expect(onChange).not.toHaveBeenCalled())
  })

  it('toont foutmelding als validateImageFiles gooit (bijv. corrupt bestand)', async () => {
    mockValidate.mockImplementationOnce(() => {
      throw new Error('Alleen afbeeldingen zijn toegestaan.')
    })
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    // image/png passeert het clipboard-filter; validateImageFiles gooit voor het testen van de foutpad
    triggerPaste(getPasteZone(), [new File([''], 'corrupt.png', { type: 'image/png' })])
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('meerdere afbeeldingen tegelijk plakken werkt', async () => {
    mockResize.mockResolvedValueOnce(mockPhoto).mockResolvedValueOnce(mockPhoto2)
    const onChange = vi.fn()
    render(<PhotoUpload photos={[]} onChange={onChange} />)
    triggerPaste(getPasteZone(), [
      new File([''], 'screen1.png', { type: 'image/png' }),
      new File([''], 'screen2.png', { type: 'image/png' }),
    ])
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledOnce()
      const updater = onChange.mock.calls[0][0] as (prev: Photo[]) => Photo[]
      expect(updater([])).toHaveLength(2)
    })
  })

  it('upload-icoontje opent file dialog (stopPropagation voorkomt paste-conflict)', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    const uploadBtn = screen.getByRole('button', { name: 'Bestand uploaden' })
    // stopPropagation is aanwezig: klik mag de paste-zone niet triggeren
    const pasteZone = getPasteZone()
    const onPasteSpy = vi.fn()
    pasteZone.addEventListener('paste', onPasteSpy)
    fireEvent.click(uploadBtn)
    expect(onPasteSpy).not.toHaveBeenCalled()
  })
})

describe('PhotoUpload — invalid styling', () => {
  it('mobiele knop heeft grijze border zonder invalid', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    const btn = screen.getByText("Foto's toevoegen (meerdere mogelijk)").closest('button')!
    expect(btn.className).toContain('border-gray-200')
    expect(btn.className).not.toContain('border-red-400')
  })

  it('mobiele knop heeft rode border bij invalid=true', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} invalid />)
    const btn = screen.getByText("Foto's toevoegen (meerdere mogelijk)").closest('button')!
    expect(btn.className).toContain('border-red-400')
  })

  it('desktop paste-zone heeft grijze border zonder invalid', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} />)
    expect(getPasteZone().className).toContain('border-gray-200')
    expect(getPasteZone().className).not.toContain('border-red-400')
  })

  it('desktop paste-zone heeft rode border bij invalid=true', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} invalid />)
    expect(getPasteZone().className).toContain('border-red-400')
    expect(getPasteZone().className).not.toContain('border-gray-200')
  })

  it('desktop paste-zone heeft grijze border bij invalid=false', () => {
    render(<PhotoUpload photos={[]} onChange={vi.fn()} invalid={false} />)
    expect(getPasteZone().className).toContain('border-gray-200')
  })
})
