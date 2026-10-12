/**
 * Heeft deze JPEG belichtingsgegevens (sluitertijd of diafragma) in de EXIF?
 * Die schrijft alleen een camera; een screenshot heeft ze nooit. Het omgekeerde
 * geldt niet: WhatsApp e.d. halen EXIF uit gewone foto's weg. Daarom alleen
 * gebruiken als "zeker een foto", nooit als "dus een screenshot".
 */
export async function heeftCameraExif(file: Blob): Promise<boolean> {
  try {
    // De EXIF staat vooraan in het bestand; de rest hoeft niet in het geheugen
    return cameraExifInJpeg(new DataView(await leesBytes(file.slice(0, 128 * 1024))))
  } catch {
    return false // geen JPEG of afgekapte EXIF: buiten de grenzen gelezen
  }
}

function leesBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

const SOI = 0xffd8 // begin van een JPEG
const SOS = 0xffda // begin van de beelddata: daarna geen metadata meer
const APP1 = 0xffe1
const EXIF = 0x45786966 // "Exif"
const TAG_EXIF_IFD = 0x8769
const TAG_SLUITERTIJD = 0x829a
const TAG_DIAFRAGMA = 0x829d

function cameraExifInJpeg(v: DataView): boolean {
  if (v.getUint16(0) !== SOI) return false
  let pos = 2
  while (pos + 4 <= v.byteLength) {
    const marker = v.getUint16(pos)
    if ((marker & 0xff00) !== 0xff00 || marker === SOS) return false
    if (marker === APP1 && v.getUint32(pos + 4) === EXIF) return heeftBelichting(v, pos + 10)
    pos += 2 + v.getUint16(pos + 2)
  }
  return false
}

/** `tiff` wijst naar de TIFF-header direct na "Exif\0\0". */
function heeftBelichting(v: DataView, tiff: number): boolean {
  const little = v.getUint16(tiff) === 0x4949 // "II"; anders "MM" (big-endian)
  const u16 = (o: number) => v.getUint16(tiff + o, little)
  const u32 = (o: number) => v.getUint32(tiff + o, little)

  const tagWaarde = (ifd: number, tag: number): number | undefined => {
    const aantal = u16(ifd)
    for (let i = 0; i < aantal; i++) {
      const entry = ifd + 2 + i * 12
      if (u16(entry) === tag) return u32(entry + 8)
    }
    return undefined
  }

  const exifIfd = tagWaarde(u32(4), TAG_EXIF_IFD)
  if (exifIfd === undefined) return false
  return tagWaarde(exifIfd, TAG_SLUITERTIJD) !== undefined || tagWaarde(exifIfd, TAG_DIAFRAGMA) !== undefined
}
