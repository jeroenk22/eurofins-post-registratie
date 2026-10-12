import type { Photo, PhotoSoort } from './types'
import { genId } from './useStore'

const MAX_PX = 1200
const QUALITY = 0.82

export function resizeAndEncode(file: File): Promise<Photo> {
  return new Promise((resolve, reject) => {
    // Object-URL i.p.v. FileReader: een telefoonfoto van 10+ MB hoeft dan niet
    // eerst als base64-tekst in het geheugen (zwaar op bijv. een 50 MP-camera)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Kon afbeelding niet laden'))
    }
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width: w, height: h } = img
      if (w > MAX_PX || h > MAX_PX) {
        if (w > h) { h = Math.round(h * MAX_PX / w); w = MAX_PX }
        else       { w = Math.round(w * MAX_PX / h); h = MAX_PX }
      }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      const data = canvas.toDataURL('image/jpeg', QUALITY)
      canvas.width = 0; canvas.height = 0 // geheugen direct vrijgeven
      resolve({ id: genId(), name: file.name, data, soort: photoSoort(file) })
    }
    img.src = url
  })
}

const SCREENSHOT_NAAM = /screen[ _-]?shot|schermafbeelding|schermopname|schermafdruk/i

/**
 * Camera's maken nooit PNG; screenshots zijn dat op Windows, iPhone en de meeste
 * Android-toestellen wel (ook een geplakte afbeelding). Samsung slaat ze als JPG
 * op, maar met "Screenshot" in de naam.
 */
export function photoSoort(file: File): PhotoSoort {
  return file.type === 'image/png' || SCREENSHOT_NAAM.test(file.name) ? 'screenshot' : 'foto'
}

/** Eén voor één: tien grote telefoonfoto's tegelijk decoderen kan de pagina laten vastlopen. */
async function resizeAllSequentially(files: File[]): Promise<Photo[]> {
  const photos: Photo[] = []
  for (const file of files) photos.push(await resizeAndEncode(file))
  return photos
}

export function validateImageFiles(files: File[]): void {
  const invalid = files.filter((f) => !f.type.startsWith('image/'))
  if (invalid.length === 0) return
  const names = invalid.map((f) => f.name).join(', ')
  throw new Error(`Alleen afbeeldingen zijn toegestaan. Niet toegestaan: ${names}`)
}

export async function processFiles(files: FileList): Promise<Photo[]> {
  const fileArray = Array.from(files)
  validateImageFiles(fileArray)
  return resizeAllSequentially(fileArray)
}
