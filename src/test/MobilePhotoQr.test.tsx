import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MobilePhotoQr from '../components/MobilePhotoQr'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fakeqr') },
}))

const renderQr = (props: Partial<Parameters<typeof MobilePhotoQr>[0]> = {}) =>
  render(
    <MobilePhotoQr sessionId="s1" pushState="synced" onRetry={() => {}} ready received={false} {...props} />,
  )

describe('MobilePhotoQr', () => {
  it('toont de QR-code pas na een klik, zwevend', async () => {
    renderQr()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Via telefoon/ }))
    expect(screen.getByRole('dialog', { name: "Foto's via telefoon" })).toHaveClass('absolute')
    expect(await screen.findByAltText('QR code')).toBeInTheDocument()
  })

  it('kan niet open zolang er geen ontvanger gekozen is', () => {
    renderQr({ ready: false })
    const knop = screen.getByRole('button', { name: /Via telefoon/ })
    expect(knop).toBeDisabled()
    expect(knop).toHaveAttribute('title', 'Kies eerst een ontvanger')
  })

  it('sluit met Escape, een klik ernaast of het kruisje', () => {
    renderQr()
    const knop = screen.getByRole('button', { name: /Via telefoon/ })
    fireEvent.click(knop)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(knop)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(knop)
    fireEvent.click(screen.getByRole('button', { name: 'QR-code sluiten' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('laat zien dat er foto’s van de telefoon binnen zijn', () => {
    renderQr({ received: true })
    expect(screen.getByLabelText("foto's ontvangen")).toBeInTheDocument()
  })

  it('biedt opnieuw proberen als de verbinding mislukt', () => {
    const onRetry = vi.fn()
    renderQr({ pushState: 'error', onRetry })
    fireEvent.click(screen.getByRole('button', { name: /Via telefoon/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Opnieuw' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
