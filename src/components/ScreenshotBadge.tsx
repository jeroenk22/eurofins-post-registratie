import type { Photo } from '../types'

/** Label op een miniatuur: screenshots krijgt de chauffeur in Mendrix Mobile niet te zien. */
export default function ScreenshotBadge({ photo }: { photo: Photo }) {
  if (photo.soort !== 'screenshot') return null
  return (
    <span
      title="Screenshot: niet zichtbaar voor de chauffeur"
      className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1 py-px text-[9px] font-medium text-white"
    >
      screenshot
    </span>
  )
}
