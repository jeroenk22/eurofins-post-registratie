import { describe, it, expect } from 'vitest'
import { isBeschermdPad } from '../../netlify/beschermde-paden'

describe('isBeschermdPad', () => {
  it.each([
    '/.netlify/functions/sheets',
    '/.netlify/functions/forward-webhook',
    '/.netlify/functions/dagoverzicht',
    '/.netlify/functions/sheets/',
    '/.netlify/functions/SHEETS',
    '/.netlify/functions/%73heets',
    '/.netlify/functions/sheets/x',
    '/.netlify/functions/%zz',
  ])('%s is beschermd', (pad) => {
    expect(isBeschermdPad(pad)).toBe(true)
  })

  it.each([
    '/',
    '/index.html',
    '/.netlify/functions/sheetsx',
    '/.netlify/functions/session',
    '/.netlify/functions/order-ids',
    '/.netlify/functions/time',
  ])('%s is open', (pad) => {
    expect(isBeschermdPad(pad)).toBe(false)
  })
})
