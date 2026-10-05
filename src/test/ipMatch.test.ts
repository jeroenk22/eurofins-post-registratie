import { describe, it, expect } from 'vitest'
import { netwerkVan, staatOpLijst } from '../../netlify/ip-match'

describe('netwerkVan', () => {
  it('geeft een IPv4-adres ongewijzigd terug', () => {
    expect(netwerkVan('195.222.119.185')).toBe('195.222.119.185')
  })

  it('haalt een IPv4-mapped IPv6-adres terug naar IPv4', () => {
    expect(netwerkVan('::ffff:1.2.3.4')).toBe('1.2.3.4')
    expect(netwerkVan('::FFFF:102:304')).toBe('1.2.3.4')
  })

  it('geeft het /64-prefix van een IPv6-adres', () => {
    expect(netwerkVan('2a02:0a45:1234:5600:aaaa:bbbb:cccc:dddd')).toBe('2a02:a45:1234:5600::/64')
  })

  it('verwerkt :: in de invoer', () => {
    expect(netwerkVan('2a02:a45::1')).toBe('2a02:a45::/64')
    expect(netwerkVan('2a02:a45:1:2::1')).toBe('2a02:a45:1:2::/64')
    expect(netwerkVan('::1')).toBe('::/64')
  })

  it('zet hoofdletters en voorloopnullen om', () => {
    expect(netwerkVan('2A02:00A4:0000:0005:1:2:3:4')).toBe('2a02:a4:0:5::/64')
  })

  it('comprimeert een nulreeks midden in het prefix', () => {
    expect(netwerkVan('2a02:0:0:5:1:2:3:4')).toBe('2a02:0:0:5::/64')
  })

  it('negeert een zone-id', () => {
    expect(netwerkVan('2a02:a45:1:2::9%eth0')).toBe('2a02:a45:1:2::/64')
  })

  it('geeft onherkenbare invoer getrimd terug', () => {
    expect(netwerkVan('  onbekend ')).toBe('onbekend')
    expect(netwerkVan('')).toBe('')
    expect(netwerkVan('1.2.3')).toBe('1.2.3')
    expect(netwerkVan('999.1.1.1')).toBe('999.1.1.1')
    expect(netwerkVan('1::2::3')).toBe('1::2::3')
    expect(netwerkVan('gggg::1')).toBe('gggg::1')
  })

  it('trimt een IPv4-adres', () => {
    expect(netwerkVan(' 1.2.3.4 ')).toBe('1.2.3.4')
  })
})

describe('staatOpLijst', () => {
  it('matcht een IPv4-adres exact', () => {
    expect(staatOpLijst('1.2.3.4', ['1.2.3.4'])).toBe(true)
    expect(staatOpLijst('1.2.3.5', ['1.2.3.4'])).toBe(false)
  })

  it('matcht een IPv4-CIDR', () => {
    expect(staatOpLijst('1.2.3.200', ['1.2.3.0/24'])).toBe(true)
    expect(staatOpLijst('1.2.4.1', ['1.2.3.0/24'])).toBe(false)
    expect(staatOpLijst('1.2.3.130', ['1.2.3.128/25'])).toBe(true)
    expect(staatOpLijst('1.2.3.127', ['1.2.3.128/25'])).toBe(false)
    expect(staatOpLijst('9.9.9.9', ['0.0.0.0/0'])).toBe(true)
    expect(staatOpLijst('1.2.3.4', ['1.2.3.4/32'])).toBe(true)
    expect(staatOpLijst('1.2.3.5', ['1.2.3.4/32'])).toBe(false)
  })

  it('wijst een ongeldige CIDR-lengte af', () => {
    expect(staatOpLijst('1.2.3.4', ['1.2.3.0/33'])).toBe(false)
    expect(staatOpLijst('1.2.3.4', ['1.2.3.0/abc'])).toBe(false)
    expect(staatOpLijst('1.2.3.4', ['1.2.3.0/'])).toBe(false)
    expect(staatOpLijst('1.2.3.4', ['1.2.3.0/24/1'])).toBe(false)
  })

  it('matcht een IPv6-/64-prefix', () => {
    const lijst = ['2a02:a45:1234:5600::/64']
    expect(staatOpLijst('2a02:a45:1234:5600:1:2:3:4', lijst)).toBe(true)
    expect(staatOpLijst('2a02:a45:1234:5601:1:2:3:4', lijst)).toBe(false)
  })

  it('matcht een volledig IPv6-adres op het /64', () => {
    expect(staatOpLijst('2a02:a45:1234:5600::9', ['2a02:a45:1234:5600:aaaa::1'])).toBe(true)
    expect(staatOpLijst('2a02:a45:1234:5700::9', ['2a02:a45:1234:5600:aaaa::1'])).toBe(false)
  })

  it('matcht een prefix in ongecomprimeerde of hoofdletter-notatie', () => {
    expect(staatOpLijst('2a02:a45::5', ['2A02:0A45:0:0::/64'])).toBe(true)
  })

  it('matcht IPv4-mapped IPv6 tegen een IPv4-regel', () => {
    expect(staatOpLijst('::ffff:1.2.3.4', ['1.2.3.4'])).toBe(true)
    expect(staatOpLijst('::ffff:1.2.3.4', ['1.2.3.0/24'])).toBe(true)
  })

  it('matcht IPv4 en IPv6 niet door elkaar', () => {
    expect(staatOpLijst('1.2.3.4', ['2a02:a45::/64'])).toBe(false)
    expect(staatOpLijst('2a02:a45::1', ['1.2.3.4'])).toBe(false)
  })

  it('trimt regels en negeert lege regels', () => {
    expect(staatOpLijst('1.2.3.4', ['', '   ', ' 1.2.3.4 '])).toBe(true)
    expect(staatOpLijst('1.2.3.4', ['', '  '])).toBe(false)
  })

  it('geeft false bij een lege lijst, onbekend IP of rommelregel', () => {
    expect(staatOpLijst('1.2.3.4', [])).toBe(false)
    expect(staatOpLijst('onbekend', ['onbekend', '1.2.3.4'])).toBe(false)
    expect(staatOpLijst('1.2.3.4', ['rommel', '1.2.3'])).toBe(false)
  })
})
