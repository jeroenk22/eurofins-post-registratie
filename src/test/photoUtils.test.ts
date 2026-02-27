import { describe, it, expect, vi } from 'vitest'

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
