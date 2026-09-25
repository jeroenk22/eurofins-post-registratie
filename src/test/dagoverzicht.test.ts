import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../../netlify/functions/dagoverzicht'
import { dagoverzichtHtml, dagoverzichtSubject, esc } from '../../netlify/dagoverzicht-mail'

const item = (over: Record<string, unknown> = {}) => ({
  sentAt: '2026-09-24T09:22:31.000Z', orderId: '1293793', name: 'Jansen (Wageningen)',
  route: 'Route 3', colli: 2, colliOmschrijvingen: ['Doos', 'Koelbox'], spoed: false, ...over,
})
const post = (body: unknown) =>
  handler(new Request('https://post-aanmelden.netlify.app/.netlify/functions/dagoverzicht', {
    method: 'POST', body: JSON.stringify(body),
  }))

describe('dagoverzicht — functie', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    vi.stubEnv('DAGOVERZICHT_WEBHOOK_URL', 'https://hook.eu2.make.com/dagoverzicht')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('stuurt aan, cc, onderwerp en HTML naar het Make-scenario', async () => {
    const res = await post({ to: 'magazijn@eurofins.nl', cc: 'chef@eurofins.nl', senderName: 'Jeroen', items: [item()] })
    expect(res.status).toBe(200)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://hook.eu2.make.com/dagoverzicht')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.to).toBe('magazijn@eurofins.nl')
    expect(body.cc).toBe('chef@eurofins.nl')
    expect(body.subject).toMatch(/^Dagoverzicht post \d\d-\d\d-\d{4} – 1 zending$/)
    expect(body.html).toContain('Order 1293793')
    expect(body.html).toContain('https://post-aanmelden.netlify.app/email/miedema-logo.png')
  })

  it('stuurt de API-sleutel van de Make-webhook mee als die is ingesteld', async () => {
    await post({ to: 'a@b.nl', items: [item()] })
    expect(((vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>)['x-make-apikey']).toBeUndefined()

    vi.stubEnv('DAGOVERZICHT_WEBHOOK_KEY', 'geheim-123')
    await post({ to: 'a@b.nl', items: [item()] })
    expect(((vi.mocked(fetch).mock.calls[1][1] as RequestInit).headers as Record<string, string>)['x-make-apikey']).toBe('geheim-123')
  })

  it('weigert zonder geldig e-mailadres of zonder zendingen', async () => {
    expect((await post({ to: 'geen-adres', items: [item()] })).status).toBe(400)
    expect((await post({ to: 'a@b.nl', cc: 'fout', items: [item()] })).status).toBe(400)
    expect((await post({ to: 'a@b.nl', items: [] })).status).toBe(400)
    expect((await post({ to: 'a@b.nl', items: [item({ colli: 0 })] })).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('meldt het als het scenario nog niet is ingesteld', async () => {
    vi.stubEnv('DAGOVERZICHT_WEBHOOK_URL', '')
    const res = await post({ to: 'a@b.nl', items: [item()] })
    expect(res.status).toBe(503)
    expect((await res.json()).error).toContain('nog niet ingesteld')
  })

  it('geeft 502 als Make faalt of onbereikbaar is', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    expect((await post({ to: 'a@b.nl', items: [item()] })).status).toBe(502)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('down'))
    expect((await post({ to: 'a@b.nl', items: [item()] })).status).toBe(502)
  })

  it('zet nooit HTML van buiten in de mail', async () => {
    await post({ to: 'a@b.nl', senderName: '<b>x</b>', items: [item({ name: '<img src=x onerror=alert(1)>', colliOmschrijvingen: ['<script>'] })] })
    const html = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string).html as string
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('laat een verzonnen ordernummer weg', async () => {
    await post({ to: 'a@b.nl', items: [item({ orderId: '12"><a' })] })
    const html = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string).html as string
    expect(html).toContain('Geen ordernummer')
  })
})

describe('dagoverzicht — de mail', () => {
  const nu = new Date('2026-09-24T15:00:00.000Z')

  it('telt zendingen, colli en spoed, en toont ze oudste eerst', () => {
    const html = dagoverzichtHtml({ senderName: 'Jeroen', items: [
      item({ sentAt: '2026-09-24T12:05:00.000Z', name: 'Tweede', spoed: true, colli: 1 }),
      item({ name: 'Eerste' }),
    ] }, nu, 'https://site.nl/')
    expect(html).toContain('donderdag 24 september 2026')
    expect(html).toContain('aangemeld door Jeroen')
    expect(html.indexOf('Eerste')).toBeLessThan(html.indexOf('Tweede'))
    expect(html).toMatch(/>2<\/td>[\s\S]*zendingen/)
    expect(html).toMatch(/>3<\/td>[\s\S]*colli/)
    expect(html).toContain('SPOED')
    expect(html).toContain('https://site.nl/email/eurofins-agro.png')
  })

  it('noemt zendingen zonder ordernummer', () => {
    const html = dagoverzichtHtml({ senderName: '', items: [item({ orderId: null })] }, nu, 'https://site.nl')
    expect(html).toContain('Geen ordernummer')
    expect(html).toContain('de order in Mendrix niet aangemaakt')
  })

  it('onderwerp en escape', () => {
    expect(dagoverzichtSubject([item(), item()], nu)).toBe('Dagoverzicht post 24-09-2026 – 2 zendingen')
    expect(esc(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
  })
})
