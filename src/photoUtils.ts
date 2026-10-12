import type { Photo, PhotoSoort } from './types'
import { genId } from './useStore'
import { heeftCameraExif } from './cameraExif'

const MAX_PX = 1200
const QUALITY = 0.82

export async function resizeAndEncode(file: File): Promise<Photo> {
  const [{ data, width, height }, cameraExif] = await Promise.all([verkleinNaarJpeg(file), heeftCameraExif(file)])
  // Cameragegevens maken het zeker een foto, ook als de afmetingen op een screenshot lijken (panorama, 9:20)
  return { id: genId(), name: file.name, data, soort: cameraExif ? 'foto' : photoSoort(file, width, height) }
}

/** Geeft ook de oorspronkelijke afmetingen terug, voor het herkennen van screenshots. */
function verkleinNaarJpeg(file: File): Promise<{ data: string; width: number; height: number }> {
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
      const { width, height } = img
      let w = width, h = height
      if (w > MAX_PX || h > MAX_PX) {
        if (w > h) { h = Math.round(h * MAX_PX / w); w = MAX_PX }
        else       { w = Math.round(w * MAX_PX / h); h = MAX_PX }
      }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      const data = canvas.toDataURL('image/jpeg', QUALITY)
      canvas.width = 0; canvas.height = 0 // geheugen direct vrijgeven
      resolve({ data, width, height })
    }
    img.src = url
  })
}

const SCREENSHOT_NAAM = /screen[ _-]?shot|schermafbeelding|schermopname|schermafdruk/i

/**
 * Camera's maken nooit PNG; screenshots zijn dat op Windows, iPhone en de meeste
 * Android-toestellen wel (ook een geplakte afbeelding). Samsung slaat ze als JPG
 * op, en de fotokiezer van Android geeft ze vaak een nummer als naam
 * (1000012345.jpg). Dan verraden de afmetingen het: precies zo groot als het
 * scherm, of langwerpig als een telefoonscherm (19,5:9 en langer). Camerafoto's
 * zijn 4:3, 16:9 of vierkant.
 */
export function photoSoort(file: File, width: number, height: number): PhotoSoort {
  if (file.type === 'image/png' || SCREENSHOT_NAAM.test(file.name)) return 'screenshot'
  const lang = Math.max(width, height)
  const kort = Math.min(width, height)
  if (kort > 0 && lang / kort >= TELEFOONSCHERM_VERHOUDING) return 'screenshot'
  return isSchermformaat(lang, kort) ? 'screenshot' : 'foto'
}

const TELEFOONSCHERM_VERHOUDING = 2

/** Zelfde afmetingen als het scherm van dit apparaat (in echte pixels, beide standen). */
function isSchermformaat(lang: number, kort: number): boolean {
  const dpr = window.devicePixelRatio || 1
  const schermLang = Math.round(Math.max(screen.width, screen.height) * dpr)
  const schermKort = Math.round(Math.min(screen.width, screen.height) * dpr)
  // Afronding van devicePixelRatio kan een paar pixels schelen
  return Math.abs(lang - schermLang) <= 4 && Math.abs(kort - schermKort) <= 4
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
