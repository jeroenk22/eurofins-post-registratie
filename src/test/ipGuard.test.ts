import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  FILTER_ENABLED: true,
  ALLOWED_IPS: ['1.1.1.1'] as string[],
}))

vi.mock('../../netlify/allowed-ips.ts', () => mockConfig)

import handler from '../../netlify/edge-functions/ip-guard'
import { CLIENT_IP_HEADER } from '../../netlify/client-ip'

function makeContext(ip: string) {
  return {
    ip,
    next: vi.fn((_request?: Request) => Promise.resolve(new Response('ok'))),
  }
}

describe('ip-guard', () => {
  beforeEach(() => {
    mockConfig.FILTER_ENABLED = true
    mockConfig.ALLOWED_IPS = ['1.1.1.1']
  })

  it('laat alle IPs door als het filter uitgeschakeld is', async () => {
    mockConfig.FILTER_ENABLED = false
    const context = makeContext('9.9.9.9')
    await handler(new Request('https://example.com'), context)
    expect(context.next).toHaveBeenCalledOnce()
  })

  it('laat een gewhitelisted IP door', async () => {
    const context = makeContext('1.1.1.1')
    await handler(new Request('https://example.com'), context)
    expect(context.next).toHaveBeenCalledOnce()
  })

  it('blokkeert een IP dat niet op de whitelist staat', async () => {
    const context = makeContext('9.9.9.9')
    const response = await handler(new Request('https://example.com'), context)
    expect(response?.status).toBe(403)
    expect(context.next).not.toHaveBeenCalled()
  })

  it('403-response bevat de Nederlandse foutmelding en het gedetecteerde IP', async () => {
    const context = makeContext('9.9.9.9')
    const response = await handler(new Request('https://example.com'), context)
    const text = await response!.text()
    expect(text).toContain('Toegang geweigerd')
    expect(text).toContain('goedgekeurd netwerk')
    expect(text).toContain('9.9.9.9')
  })

  it('/debug-ip retourneert het gedetecteerde IP als JSON', async () => {
    const context = makeContext('9.9.9.9')
    const response = await handler(new Request('https://example.com/debug-ip'), context)
    const json = await response!.json()
    expect(json.ip).toBe('9.9.9.9')
    expect(json.filterEnabled).toBe(true)
    expect(json.allowed).toBe(false)
    expect(json.allowedIps).toBeUndefined()
  })

  describe('echt IP doorgeven aan de functies', () => {
    it('zet het IP als header op een verzoek naar een functie, ook met een body', async () => {
      mockConfig.FILTER_ENABLED = false
      const context = makeContext('195.222.119.185')
      await handler(new Request('https://example.com/.netlify/functions/forward-webhook', {
        method: 'POST', body: '{"entries":[]}',
      }), context)
      const doorgegeven = context.next.mock.calls[0][0]!
      expect(doorgegeven.headers.get(CLIENT_IP_HEADER)).toBe('195.222.119.185')
      expect(doorgegeven.method).toBe('POST')
      expect(await doorgegeven.text()).toBe('{"entries":[]}')
    })

    it('overschrijft een header die de browser zelf meestuurt', async () => {
      const context = makeContext('1.1.1.1')
      await handler(new Request('https://example.com/.netlify/functions/forward-webhook', {
        method: 'POST', headers: { [CLIENT_IP_HEADER]: '6.6.6.6' }, body: '{}',
      }), context)
      expect(context.next.mock.calls[0][0]!.headers.get(CLIENT_IP_HEADER)).toBe('1.1.1.1')
    })

    it('laat andere verzoeken ongemoeid', async () => {
      const context = makeContext('1.1.1.1')
      await handler(new Request('https://example.com/index.html'), context)
      expect(context.next.mock.calls[0][0]).toBeUndefined()
    })
  })
})
