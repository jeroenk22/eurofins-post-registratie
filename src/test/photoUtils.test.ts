import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { photoSoort, validateImageFiles } from '../photoUtils'

// Mock browser APIs not available in jsdom
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
  toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockdata'),
}

vi.stubGlobal('document', {
  ...document,
  createElement: (tag: string) => {
    if (tag === 'canvas') return mockCanvas
    return document.createElement(tag)
  },
})

describe('photo resize logic', () => {
  const MAX_PX = 1200

  function calculateDimensions(w: number, h: number) {
    if (w > MAX_PX || h > MAX_PX) {
      if (w > h) { h = Math.round(h * MAX_PX / w); w = MAX_PX }
      else       { w = Math.round(w * MAX_PX / h); h = MAX_PX }
    }
    return { w, h }
  }

  it('does not resize images within the limit', () => {
    expect(calculateDimensions(800, 600)).toEqual({ w: 800, h: 600 })
    expect(calculateDimensions(1200, 1200)).toEqual({ w: 1200, h: 1200 })
    expect(calculateDimensions(100, 100)).toEqual({ w: 100, h: 100 })
  })

  it('scales down landscape images correctly', () => {
    const { w, h } = calculateDimensions(2400, 1200)
    expect(w).toBe(1200)
    expect(h).toBe(600)
  })

  it('scales down portrait images correctly', () => {
    const { w, h } = calculateDimensions(1200, 2400)
    expect(w).toBe(600)
    expect(h).toBe(1200)
  })

  it('scales down square images correctly', () => {
    const { w, h } = calculateDimensions(2400, 2400)
    expect(w).toBe(1200)
    expect(h).toBe(1200)
  })

  it('preserves aspect ratio for wide image', () => {
    const original = { w: 3000, h: 1000 }
    const result = calculateDimensions(original.w, original.h)
    const ratio = result.w / result.h
    const originalRatio = original.w / original.h
    expect(Math.abs(ratio - originalRatio)).toBeLessThan(0.01)
  })
})

describe('validateImageFiles', () => {
  it('does not throw for image files', () => {
    const files = [
      new File([''], 'foto.jpg', { type: 'image/jpeg' }),
      new File([''], 'foto.png', { type: 'image/png' }),
    ]
    expect(() => validateImageFiles(files)).not.toThrow()
  })

  it('throws for a non-image file', () => {
    const files = [new File([''], 'document.pdf', { type: 'application/pdf' })]
    expect(() => validateImageFiles(files)).toThrowError('Alleen afbeeldingen zijn toegestaan')
  })

  it('includes the filename in the error message', () => {
    const files = [new File([''], 'malware.exe', { type: 'application/octet-stream' })]
    expect(() => validateImageFiles(files)).toThrowError('malware.exe')
  })

  it('throws when mixed valid and invalid files are provided', () => {
    const files = [
      new File([''], 'foto.jpg', { type: 'image/jpeg' }),
      new File([''], 'document.pdf', { type: 'application/pdf' }),
    ]
    expect(() => validateImageFiles(files)).toThrowError('document.pdf')
  })

  it('does not throw for an empty array', () => {
    expect(() => validateImageFiles([])).not.toThrow()
  })
})

describe('photoSoort', () => {
  const file = (name: string, type: string) => new File([''], name, { type })
  const FOTO_4_3 = [4000, 3000] as const

  beforeEach(() => {
    // Telefoon met een scherm van 1080 × 2340 echte pixels (zoals de Galaxy A26)
    vi.spyOn(screen, 'width', 'get').mockReturnValue(384)
    vi.spyOn(screen, 'height', 'get').mockReturnValue(832)
    vi.stubGlobal('devicePixelRatio', 2.8125)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('herkent geplakte afbeeldingen en PNG-screenshots', () => {
    expect(photoSoort(file('image.png', 'image/png'), 1920, 1080)).toBe('screenshot') // Ctrl+V op de desktop
    expect(photoSoort(file('IMG_0042.PNG', 'image/png'), 1170, 2532)).toBe('screenshot') // iPhone
  })

  it('herkent screenshots aan de naam, ook als JPG', () => {
    expect(photoSoort(file('Screenshot_20261012_093000_Gmail.jpg', 'image/jpeg'), ...FOTO_4_3)).toBe('screenshot') // Samsung
    expect(photoSoort(file('Schermafbeelding 2026-10-12 093000.jpg', 'image/jpeg'), ...FOTO_4_3)).toBe('screenshot')
    expect(photoSoort(file('Schermopname (12).jpg', 'image/jpeg'), ...FOTO_4_3)).toBe('screenshot')
    expect(photoSoort(file('screen shot 1.jpeg', 'image/jpeg'), ...FOTO_4_3)).toBe('screenshot')
  })

  it('herkent een JPG-screenshot met een nummer als naam aan de afmetingen', () => {
    // Android-fotokiezer: geen "Screenshot" meer in de naam
    expect(photoSoort(file('1000012345.jpg', 'image/jpeg'), 1080, 2340)).toBe('screenshot') // dit scherm
    expect(photoSoort(file('1000012345.jpg', 'image/jpeg'), 2340, 1080)).toBe('screenshot') // liggend
    expect(photoSoort(file('1000012346.jpg', 'image/jpeg'), 1170, 2532)).toBe('screenshot') // andere telefoon (bijv. via WhatsApp)
  })

  it("behandelt camerafoto's als foto", () => {
    expect(photoSoort(file('20261012_093000.jpg', 'image/jpeg'), ...FOTO_4_3)).toBe('foto') // Samsung-camera
    expect(photoSoort(file('IMG_1234.jpeg', 'image/jpeg'), 3024, 4032)).toBe('foto') // iPhone
    expect(photoSoort(file('1000012347.jpg', 'image/jpeg'), 1920, 1080)).toBe('foto') // 16:9
    expect(photoSoort(file('image.jpg', 'image/jpeg'), 3000, 3000)).toBe('foto') // vierkant
  })
})
