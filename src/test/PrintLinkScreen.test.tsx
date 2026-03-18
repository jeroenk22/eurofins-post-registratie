import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrintLinkScreen from '../components/PrintLinkScreen'
import type { PrintEntry } from '../services/printService'

const entries: PrintEntry[] = [
  { name: 'Bart Wijtvliet', adres: 'Kerkstraat 1', postcode: '1234AB', plaats: 'Zevenbergen', land: 'Nederland', route: 'Route 5', colli: 3, spoed: false },
  { name: 'Adrie Bakker', adres: 'Dorpsweg 5', postcode: '5678CD', plaats: 'Ovezande', land: 'Nederland', route: 'Route 5', colli: 2, spoed: false },
]

describe('PrintLinkScreen', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
  })

  it('toont alle entries', () => {
    render(<PrintLinkScreen entries={entries} />)
    expect(screen.getByText(/Bart Wijtvliet/)).toBeInTheDocument()
    expect(screen.getByText(/Adrie Bakker/)).toBeInTheDocument()
  })

  it('toont totaal aantal colli in de print-all knop', () => {
    render(<PrintLinkScreen entries={entries} />)
    expect(screen.getByText('Print alle labels (5 colli)')).toBeInTheDocument()
  })

  it('navigeert naar / bij klikken op Nieuwe aanmelding', () => {
    render(<PrintLinkScreen entries={entries} />)
    fireEvent.click(screen.getByText('+ Nieuwe aanmelding'))
    expect(window.location.href).toBe('/')
  })
})
