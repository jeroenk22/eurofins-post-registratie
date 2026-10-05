import { describe, it, expect, vi, afterEach } from 'vitest'
import { mailDagoverzicht } from '../services/dagoverzicht'
import type { SentItem } from '../services/sentToday'

const item = (id: string, over: Partial<SentItem> = {}): SentItem => ({
  id,
  sentAt: '2026-09-24T09:22:31.000Z',
  orderId: '1293793',
  label: { name: `Naam ${id}`, adres: 'Straat 1', postcode: '1234AB', plaats: 'Plaats', land: 'Nederland', route: 'Route 3', colli: 2, colliOmschrijvingen: ['Doos', 'Koelbox', 'Extra'], spoed: false },
  ...over,
})

describe('mailDagoverzicht (client)', () => {
  afterEach(() => vi.unstubAllGlobals())

  const verstuur = async (items: SentItem[]) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    await mailDagoverzicht(items, ' a@b.nl ', '', ' Jeroen ')
    return JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
  }

  it('stuurt labels (oudste eerst) in plaats van printData', async () => {
    const body = await verstuur([item('nieuw'), item('oud')])
    expect(body.printData).toBeUndefined()
    expect(body.labels.map((l: { name: string }) => l.name)).toEqual(['Naam oud', 'Naam nieuw'])
    expect(body.items.map((i: { name: string }) => i.name)).toEqual(['Naam nieuw', 'Naam oud'])
  })

  it('stuurt per item submissionId en fotoCount', async () => {
    const details = { schap: 'Schap 3', photoCount: 4, senderName: '', senderPhone: '', senderEmail: '', senderCcEmail: '', mailVerstuurd: true }
    const body = await verstuur([item('a', { submissionId: 'abcdEFGH1234_-xy', details }), item('b')])
    expect(body.items[0]).toEqual(expect.objectContaining({ submissionId: 'abcdEFGH1234_-xy', fotoCount: 4 }))
    expect(body.items[1].fotoCount).toBe(0)
    expect(body.items[1].submissionId).toBeUndefined()
  })
})
