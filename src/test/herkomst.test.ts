import { describe, it, expect, vi } from 'vitest'
import { zoekHerkomst } from '../../netlify/herkomst'

const vcard = (fn: string) => ({ vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', fn]]] })
const antwoord = (body: unknown, ok = true) => vi.fn(async (_url: string, _init?: RequestInit) => ({ ok, json: async () => body }) as Response)

describe('zoekHerkomst', () => {
  it('herkent Amazon aan de registrant en aan de netwerknaam', async () => {
    const f = antwoord({ name: 'AMAZON-IAD', entities: [{ roles: ['registrant'], ...vcard('Amazon Data Services Northern Virginia') }] })
    expect(await zoekHerkomst('3.80.1.1', f)).toBe('Amazon-server (VS): robot, geen werkplek. Geen toegang geven.')
    expect(f.mock.calls[0][0]).toBe('https://rdap.arin.net/registry/ip/3.80.1.1')
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: 'follow' })
    const g = antwoord({ name: 'AT-88-Z', entities: [{ roles: ['registrant'], ...vcard('Amazon Technologies Inc.') }] })
    expect(await zoekHerkomst('52.1.1.1', g)).toContain('Amazon-server')
  })

  it('herkent een andere cloudpartij', async () => {
    const f = antwoord({ name: 'HETZNER-FSN', entities: [{ roles: ['registrant'], ...vcard('Hetzner Online GmbH') }] })
    expect(await zoekHerkomst('1.2.3.4', f)).toBe('Hetzner-server: geen werkplek. Geen toegang geven.')
  })

  it('herkent Zscaler', async () => {
    const f = antwoord({ name: 'ZSCALER-AMS2', country: 'NL', entities: [
      { roles: ['administrative', 'technical'], ...vcard('Zscaler Operations') },
      { roles: ['registrant'], ...vcard('ZSCALER-RIPE-MNT') },
    ] })
    expect(await zoekHerkomst('165.225.240.1', f)).toBe(
      'Zscaler (beveiligd bedrijfsnetwerk, o.a. Eurofins-laptops; adres wordt gedeeld en wisselt)',
    )
  })

  it('slaat handles over en kiest de leesbare registrant (KPN)', async () => {
    const f = antwoord({ name: 'PTT', country: 'NL', entities: [
      { roles: ['registrant'], ...vcard('KPN-MNT') },
      { roles: ['administrative', 'technical'], ...vcard('KPN Internet') },
      { roles: ['registrant'], ...vcard('KPN B.V.') },
      { roles: ['registrant'], ...vcard('RIPE-NCC-LEGACY-MNT') },
    ] })
    expect(await zoekHerkomst('145.53.1.1', f)).toBe('KPN B.V. (NL)')
    const g = antwoord({ name: 'X-NET', country: 'NL', entities: [
      { roles: ['registrant'], ...vcard('EEN-MNT') },
      { roles: ['administrative'], ...vcard('Piet Internet') },
    ] })
    expect(await zoekHerkomst('1.1.1.1', g)).toBe('Piet Internet (NL)')
    const h = antwoord({ name: 'PTT', country: 'NL', entities: [{ roles: ['registrant'], ...vcard('KPN-MNT') }] })
    expect(await zoekHerkomst('1.1.1.1', h)).toBe('PTT (NL)')
  })

  it('geeft naam en land voor een gewone provider, en alleen de naam zonder land', async () => {
    const kpn = antwoord({ name: 'KPN-NET', country: 'nl', entities: [{ roles: ['registrant'], ...vcard('KPN B.V.') }] })
    expect(await zoekHerkomst('145.1.1.1', kpn)).toBe('KPN B.V. (NL)')
    const zonder = antwoord({ name: 'X-NET', entities: [{ roles: ['registrant'], ...vcard('Piet BV') }] })
    expect(await zoekHerkomst('1.1.1.1', zonder)).toBe('Piet BV')
    const alleenNaam = antwoord({ name: 'MIJN-NET', country: 'NL' })
    expect(await zoekHerkomst('1.1.1.1', alleenNaam)).toBe('MIJN-NET (NL)')
  })

  it('gebruikt bij een IPv6-prefix het adres zonder /64', async () => {
    const f = antwoord({ name: 'X', country: 'NL' })
    await zoekHerkomst('2001:db8:1:2::/64', f)
    expect(f.mock.calls[0][0]).toBe('https://rdap.arin.net/registry/ip/2001:db8:1:2::')
  })

  it('geeft null bij een fout of een HTTP-fout', async () => {
    expect(await zoekHerkomst('1.1.1.1', vi.fn(async () => { throw new Error('stuk') }))).toBeNull()
    expect(await zoekHerkomst('1.1.1.1', antwoord({}, false))).toBeNull()
    expect(await zoekHerkomst('1.1.1.1', antwoord({}))).toBeNull()
  })

  it('doet geen lookup voor iets dat geen adres is', async () => {
    const f = antwoord({})
    expect(await zoekHerkomst('../x?y', f)).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('geeft null bij een timeout van 5 seconden', async () => {
    vi.useFakeTimers()
    const f = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))
    }))
    const p = zoekHerkomst('1.1.1.1', f)
    await vi.advanceTimersByTimeAsync(5000)
    expect(await p).toBeNull()
    vi.useRealTimers()
  })
})
