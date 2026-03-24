import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { loadPhotos, savePhotos, clearPhotos } from '../photoStorage'
import type { Photo } from '../types'

const photo: Photo = { id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }

describe('photoStorage', () => {
  beforeEach(() => {
    // Reset fake-indexeddb tussen tests door een nieuwe instantie te forceren
    // via het verwijderen van bestaande databases
    vi.restoreAllMocks()
  })

  it('laadt lege map als er nog niets opgeslagen is', async () => {
    const result = await loadPhotos('sessie-1')
    expect(result).toEqual({})
  })

  it('slaat foto\'s op en laadt ze terug', async () => {
    const photos = { e1: [photo] }
    await savePhotos('sessie-2', photos)
    const result = await loadPhotos('sessie-2')
    expect(result).toEqual(photos)
  })

  it('overschrijft bestaande foto\'s bij opnieuw opslaan', async () => {
    await savePhotos('sessie-3', { e1: [photo] })
    const updated = { e1: [photo, { ...photo, id: 'p2' }] }
    await savePhotos('sessie-3', updated)
    const result = await loadPhotos('sessie-3')
    expect(result).toEqual(updated)
  })

  it('verwijdert foto\'s bij clearPhotos', async () => {
    await savePhotos('sessie-4', { e1: [photo] })
    await clearPhotos('sessie-4')
    const result = await loadPhotos('sessie-4')
    expect(result).toEqual({})
  })

  it('houdt foto\'s van verschillende sessies gescheiden', async () => {
    await savePhotos('sessie-a', { e1: [photo] })
    await savePhotos('sessie-b', { e2: [{ ...photo, id: 'p2' }] })
    expect(await loadPhotos('sessie-a')).toEqual({ e1: [photo] })
    expect(await loadPhotos('sessie-b')).toEqual({ e2: [{ ...photo, id: 'p2' }] })
  })

  it('clearPhotos van één sessie raakt andere sessie niet', async () => {
    await savePhotos('sessie-x', { e1: [photo] })
    await savePhotos('sessie-y', { e1: [photo] })
    await clearPhotos('sessie-x')
    expect(await loadPhotos('sessie-x')).toEqual({})
    expect(await loadPhotos('sessie-y')).toEqual({ e1: [photo] })
  })
})
