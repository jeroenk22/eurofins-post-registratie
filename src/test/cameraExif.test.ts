import { describe, it, expect } from 'vitest'
import { heeftCameraExif } from '../cameraExif'

/** Minimale JPEG: SOI, (optioneel) APP1-Exif met de gegeven tags in de Exif-IFD, dan SOS. */
function jpegBytes(exifTags: number[] | null, opties: { bigEndian?: boolean } = {}): Uint8Array {
  const bytes: number[] = [0xff, 0xd8]
  if (exifTags) {
    const le = !opties.bigEndian
    const u16 = (n: number) => (le ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff])
    const u32 = (n: number) => {
      const b = [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
      return le ? b : b.reverse()
    }
    const entry = (tag: number, waarde: number) => [...u16(tag), ...u16(4), ...u32(1), ...u32(waarde)]
    const exifIfdOffset = 8 + 2 + 12 + 4
    const tiff = [
      ...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8),
      // IFD0: alleen de verwijzing naar de Exif-IFD
      ...u16(1), ...entry(0x8769, exifIfdOffset), ...u32(0),
      // Exif-IFD
      ...u16(exifTags.length), ...exifTags.flatMap(tag => entry(tag, 0)), ...u32(0),
    ]
    const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff] // "Exif\0\0" + TIFF
    const lengte = app1.length + 2
    bytes.push(0xff, 0xe1, lengte >> 8, lengte & 0xff, ...app1)
  }
  bytes.push(0xff, 0xda, 0, 2)
  return new Uint8Array(bytes)
}

const blob = (bytes: Uint8Array) => new Blob([bytes.buffer as ArrayBuffer])
const jpeg = (...args: Parameters<typeof jpegBytes>) => blob(jpegBytes(...args))

describe('heeftCameraExif', () => {
  it('ziet sluitertijd of diafragma als camerafoto', async () => {
    expect(await heeftCameraExif(jpeg([0x829a]))).toBe(true) // sluitertijd
    expect(await heeftCameraExif(jpeg([0x829d]))).toBe(true) // diafragma
    expect(await heeftCameraExif(jpeg([0x9003, 0x829a], { bigEndian: true }))).toBe(true)
  })

  it('niet zonder belichtingsgegevens (screenshot met alleen datum/merk)', async () => {
    expect(await heeftCameraExif(jpeg([0x9003]))).toBe(false)
    expect(await heeftCameraExif(jpeg([]))).toBe(false)
  })

  it('niet zonder EXIF, of als het geen JPEG is', async () => {
    expect(await heeftCameraExif(jpeg(null))).toBe(false)
    expect(await heeftCameraExif(blob(new Uint8Array([0x89, 0x50, 0x4e, 0x47])))).toBe(false) // PNG
    expect(await heeftCameraExif(new Blob([]))).toBe(false)
  })

  it('crasht niet op een afgekapte EXIF', async () => {
    const heel = jpegBytes([0x829a])
    expect(await heeftCameraExif(blob(heel.slice(0, 20)))).toBe(false)
  })
})
