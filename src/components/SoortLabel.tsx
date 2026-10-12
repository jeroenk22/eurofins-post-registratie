import type { Photo, PhotoSoort } from '../types'

interface Props {
  photo: Photo
  /** Wisselt tussen foto en screenshot, voor als de app het verkeerd inschat. */
  onWissel: (soort: PhotoSoort) => void
}

/**
 * Label op een miniatuur: screenshots krijgt de chauffeur in Mendrix Mobile niet
 * te zien. Bewust onopvallend klikbaar: alleen de cursor verandert.
 */
export default function SoortLabel({ photo, onWissel }: Props) {
  const screenshot = photo.soort === 'screenshot'
  return (
    <button
      type="button"
      onClick={() => onWissel(screenshot ? 'foto' : 'screenshot')}
      title={screenshot ? 'Screenshot: niet zichtbaar voor de chauffeur' : 'Foto: zichtbaar voor de chauffeur'}
      // after: vergroot het tikvlak op de telefoon, zonder dat het label groter oogt
      className="absolute bottom-1 left-1 cursor-pointer rounded bg-black/60 px-1 py-px text-[9px] font-medium leading-normal text-white after:absolute after:-inset-2"
    >
      {screenshot ? 'screenshot' : 'foto'}
    </button>
  )
}
