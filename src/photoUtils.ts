import type { Photo } from './types'
import { genId } from './useStore'

const MAX_PX = 1200
const QUALITY = 0.82

export function resizeAndEncode(file: File): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Kon bestand niet lezen'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Kon afbeelding niet laden'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width: w, height: h } = img
        if (w > MAX_PX || h > MAX_PX) {
          if (w > h) { h = Math.round(h * MAX_PX / w); w = MAX_PX }
          else       { w = Math.round(w * MAX_PX / h); h = MAX_PX }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve({ id: genId(), name: file.name, data: canvas.toDataURL('image/jpeg', QUALITY) })
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

export async function processFiles(files: FileList): Promise<Photo[]> {
  return Promise.all(Array.from(files).filter(f => f.type.startsWith('image/')).map(resizeAndEncode))
}
