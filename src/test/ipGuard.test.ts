import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  FILTER_ENABLED: true,
  ALLOWED_IPS: ['1.1.1.1'] as string[],
}))

vi.mock('../../netlify/allowed-ips.ts', () => mockConfig)

import handler from '../../netlify/edge-functions/ip-guard'

function makeContext(ip: string) {
  return {
    ip,
    next: vi.fn(() => Promise.resolve(new Response('ok'))),
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

  it('403-response bevat de Nederlandse foutmelding', async () => {
    const context = makeContext('9.9.9.9')
    const response = await handler(new Request('https://example.com'), context)
    const text = await response!.text()
    expect(text).toContain('Toegang geweigerd')
    expect(text).toContain('goedgekeurd netwerk')
  })
})
