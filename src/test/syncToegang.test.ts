import { describe, it, expect, vi, beforeEach } from 'vitest'

const blobs = vi.hoisted(() => ({ getStore: vi.fn() }))
vi.mock('@netlify/blobs', () => ({ getStore: blobs.getStore }))

import syncHandler, {
  syncToegang, leesDatum, BEWAARTERMIJN_DAGEN, type SheetsClient, type SyncDeps,
} from '../../netlify/functions/sync-toegang'
import { netwerkKey, LIJST_KEY } from '../../netlify/toegang-opslag'

const NOW = Date.UTC(2026, 9, 2, 12) // 02-10-2026
const KOP = ['Netwerk', 'Eerst gezien', 'Laatst gezien', 'Aantal dagen', 'Toegestaan', 'Omschrijving', 'Herkomst']

/** Nep-sheet in het geheugen; `rijen` null betekent: het tabblad bestaat niet. */
function maakSheet(rijen: string[][] | null, faal: Partial<Record<keyof SheetsClient, boolean>> = {}) {
  const state = { rijen: (rijen ?? []).map((r) => [...r]), verwijderd: [] as number[], aanroepen: [] as string[] }
  const check = (naam: keyof SheetsClient) => {
    state.aanroepen.push(naam)
    if (faal[naam]) throw new Error(`${naam} stuk`)
  }
  const client: SheetsClient = {
    async sheetId() { check('sheetId'); return rijen === null ? null : 42 },
    async lees() { check('lees'); return state.rijen.map((r) => [...r]) },
    async schrijf(_tab, cellen) {
      check('schrijf')
      for (const c of cellen) {
        while (state.rijen.length <= c.rij) state.rijen.push([])
        while (state.rijen[c.rij].length <= c.kolom) state.rijen[c.rij].push('')
        state.rijen[c.rij][c.kolom] = c.waarde
      }
    },
    async voegToe(_tab, nieuw) { check('voegToe'); state.rijen.push(...nieuw.map((r) => [...r])) },
    async verwijderRijen(sheetId, rijenIdx) {
      check('verwijderRijen')
      expect(sheetId).toBe(42)
      expect(rijenIdx).toEqual([...rijenIdx].sort((a, b) => b - a))
      for (const i of rijenIdx) { state.rijen.splice(i, 1); state.verwijderd.push(i) }
    },
  }
  return { client, state }
}

function maakNetwerken(keys: string[]) {
  const over = new Set(keys)
  return {
    over,
    store: {
      list: () => (async function* () { yield { blobs: [...over].map((key) => ({ key })) } })(),
      delete: vi.fn(async (key: string) => { over.delete(key) }),
    },
  }
}

function opzet(
  rijen: string[][] | null, keys: string[] = [], faal: Partial<Record<keyof SheetsClient, boolean>> = {},
  zoekHerkomst: SyncDeps['zoekHerkomst'] = async () => null,
) {
  const sheet = maakSheet(rijen, faal)
  const netwerken = maakNetwerken(keys)
  const setJSON = vi.fn(async () => {})
  const deps: SyncDeps = { sheets: sheet.client, netwerken: netwerken.store, toegang: { setJSON }, zoekHerkomst }
  return { sheet, netwerken, setJSON, deps }
}

const k = (datum: string, netwerk: string) => netwerkKey(datum, netwerk)

describe('syncToegang', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('schrijft een kopregel in een lege sheet', async () => {
    const o = opzet([])
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen).toEqual([KOP])
    expect(o.setJSON).toHaveBeenCalledWith(LIJST_KEY, { netwerken: [], bijgewerkt: NOW })
  })

  it('voegt een nieuw netwerk toe met de juiste waarden en ruimt de sleutels op', async () => {
    const o = opzet([KOP], [k('2026-09-30', '1.2.3.4'), k('2026-10-01', '1.2.3.4')])
    const res = await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen[1]).toEqual(['1.2.3.4', '30-09-2026', '01-10-2026', '2', '', '', ''])
    expect(o.netwerken.over.size).toBe(0)
    expect(res).toMatchObject({ nieuw: 1, bijgewerkt: 0 })
  })

  it('telt een nieuwe dag bij een bestaand netwerk, dezelfde dag niet dubbel', async () => {
    const o = opzet([KOP, [' 1.2.3.4 ', '01-09-2026', '01-10-2026', '5', '', '']], [
      k('2026-10-01', '1.2.3.4'), k('2026-09-15', '1.2.3.4'), k('2026-10-02', '1.2.3.4'),
    ])
    const res = await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen[1].slice(0, 4)).toEqual([' 1.2.3.4 ', '01-09-2026', '02-10-2026', '6'])
    expect(res).toMatchObject({ nieuw: 0, bijgewerkt: 1 })
    // Opnieuw met dezelfde dag: geen wijziging
    const o2 = opzet(o.sheet.state.rijen, [k('2026-10-02', '1.2.3.4')])
    expect(await syncToegang(NOW, o2.deps)).toMatchObject({ bijgewerkt: 0 })
    expect(o2.sheet.state.rijen[1][3]).toBe('6')
    expect(o2.sheet.state.aanroepen).not.toContain('schrijf')
  })

  it('vergelijkt netwerken zonder hoofdletters en leest een Sheets-datumgetal', async () => {
    const o = opzet([KOP, ['2001:DB8:1:2', '01-09-2026', '46296', '3', '', '']], [k('2026-10-02', '2001:db8:1:2')])
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen).toHaveLength(2)
    expect(o.sheet.state.rijen[1][3]).toBe('4')
  })

  it('werkt met kolommen in een andere volgorde', async () => {
    const kop = ['Omschrijving', 'Toegestaan', 'Netwerk', 'Aantal dagen', 'Laatst gezien', 'Eerst gezien']
    const o = opzet([kop, ['Kantoor', 'ja', '5.6.7.8', '2', '01-10-2026', '30-09-2026']], [
      k('2026-10-02', '5.6.7.8'), k('2026-10-02', '9.9.9.9'),
    ])
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen[1]).toEqual(['Kantoor', 'ja', '5.6.7.8', '3', '02-10-2026', '30-09-2026'])
    expect(o.sheet.state.rijen[2]).toEqual(['', '', '9.9.9.9', '1', '02-10-2026', '02-10-2026', ''])
    expect(o.setJSON).toHaveBeenCalledWith(LIJST_KEY, { netwerken: ['5.6.7.8'], bijgewerkt: NOW })
  })

  it('schrijft de ja-lijst, ook bij " Ja " en "JA"', async () => {
    const o = opzet([KOP,
      ['1.1.1.1', '', '01-10-2026', '1', ' Ja ', ''],
      ['2.2.2.2', '', '01-10-2026', '1', 'JA', ''],
      ['3.3.3.3', '', '01-10-2026', '1', 'nee', ''],
      ['4.4.4.4', '', '01-10-2026', '1', '', ''],
    ])
    const res = await syncToegang(NOW, o.deps)
    expect(o.setJSON).toHaveBeenCalledWith(LIJST_KEY, { netwerken: ['1.1.1.1', '2.2.2.2'], bijgewerkt: NOW })
    expect(res?.toegestaan).toBe(2)
  })

  it('laat de lijst ongemoeid als het lezen van de sheet faalt', async () => {
    const o = opzet([KOP], [], { lees: true })
    expect(await syncToegang(NOW, o.deps)).toBeNull()
    expect(o.setJSON).not.toHaveBeenCalled()
    const o2 = opzet([KOP], [], { sheetId: true })
    await syncToegang(NOW, o2.deps)
    expect(o2.setJSON).not.toHaveBeenCalled()
  })

  it('bewaart de blob-sleutels als schrijven faalt, maar schrijft wel de lijst', async () => {
    for (const faal of ['schrijf', 'voegToe'] as const) {
      const o = opzet([KOP, ['1.1.1.1', '01-09-2026', '01-09-2026', '1', 'ja', '']],
        [k('2026-10-01', '1.1.1.1'), k('2026-10-01', '8.8.8.8')], { [faal]: true })
      await syncToegang(NOW, o.deps)
      expect(o.netwerken.store.delete).not.toHaveBeenCalled()
      expect(o.netwerken.over.size).toBe(2)
      expect(o.setJSON).toHaveBeenCalledWith(LIJST_KEY, { netwerken: ['1.1.1.1'], bijgewerkt: NOW })
    }
  })

  it('verwijdert na 60 dagen rijen zonder ja, maar nooit rijen met ja', async () => {
    const o = opzet([KOP,
      ['oud-nee', '', '02-08-2026', '3', '', ''], // 61 dagen
      ['grens', '', '03-08-2026', '3', '', ''], // 60 dagen: blijft
      ['oud-ja', '', '15-03-2026', '3', 'ja', ''], // 200 dagen
      ['oud-nee2', '', '01-01-2026', '3', 'nee', ''],
    ])
    expect(BEWAARTERMIJN_DAGEN).toBe(60)
    const res = await syncToegang(NOW, o.deps)
    expect(o.sheet.state.verwijderd).toEqual([4, 1])
    expect(o.sheet.state.rijen.map((r) => r[0])).toEqual(['Netwerk', 'grens', 'oud-ja'])
    expect(res?.verwijderd).toBe(2)
  })

  it('stopt zonder crash als het tabblad ontbreekt', async () => {
    const o = opzet(null, [k('2026-10-01', '1.1.1.1')])
    expect(await syncToegang(NOW, o.deps)).toBeNull()
    expect(o.setJSON).not.toHaveBeenCalled()
    expect(o.netwerken.over.size).toBe(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('logt geen netwerken bij fouten', async () => {
    const o = opzet([KOP, ['9.9.9.9', '', '01-09-2026', '1', '', '']], [k('2026-10-01', '9.9.9.9')], { schrijf: true })
    await syncToegang(NOW, o.deps)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('9.9.9.9')
  })

  it('past de wijzigingen toe in de volgorde schrijf, verwijder, voegToe en ruimt daarna de sleutels op', async () => {
    const o = opzet([KOP,
      ['oud', '', '01-01-2026', '3', '', ''],
      ['1.1.1.1', '01-09-2026', '01-09-2026', '1', 'ja', ''],
    ], [k('2026-10-01', '1.1.1.1'), k('2026-10-01', '7.7.7.7')])
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.aanroepen).toEqual(['sheetId', 'lees', 'schrijf', 'verwijderRijen', 'voegToe'])
    expect(o.sheet.state.verwijderd).toEqual([1])
    expect(o.sheet.state.rijen.map((r) => r[0])).toEqual(['Netwerk', '1.1.1.1', '7.7.7.7'])
    expect(o.netwerken.over.size).toBe(0)
  })

  it('verwijdert nooit een nieuwe rij in dezelfde run, ook niet bij een oude datum', async () => {
    const o = opzet([KOP], [k('2026-01-01', '6.6.6.6')])
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.aanroepen).not.toContain('verwijderRijen')
    expect(o.sheet.state.rijen.map((r) => r[0])).toEqual(['Netwerk', '6.6.6.6'])
  })

  it('verwijdert onleesbare sleutels bij het opruimen', async () => {
    const o = opzet([KOP], ['rommel', '2026-10-01/%E0%A4%A', k('2026-10-01', '1.1.1.1')])
    await syncToegang(NOW, o.deps)
    expect(o.netwerken.over.size).toBe(0)
  })

  it('laat onleesbare sleutels staan als het schrijven faalt', async () => {
    const o = opzet([KOP], ['rommel', k('2026-10-01', '1.1.1.1')], { voegToe: true })
    await syncToegang(NOW, o.deps)
    expect(o.netwerken.over.size).toBe(2)
  })

  it('bundelt de sheets-aanroepen: één schrijf en één append', async () => {
    const o = opzet([KOP, ['1.1.1.1', '01-09-2026', '01-09-2026', '1', '', ''], ['2.2.2.2', '', '01-09-2026', '1', '', '']], [
      k('2026-10-01', '1.1.1.1'), k('2026-10-01', '2.2.2.2'), k('2026-10-01', '3.3.3.3'), k('2026-10-01', '4.4.4.4'),
    ])
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.aanroepen).toEqual(['sheetId', 'lees', 'schrijf', 'voegToe'])
  })
})

describe('Herkomst', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  const OUD_KOP = KOP.slice(0, 6)
  const zoek = () => vi.fn(async (netwerk: string) => `label ${netwerk}`)

  it('voegt de kop Herkomst toe in de eerste lege kolom rechts', async () => {
    const o = opzet([OUD_KOP, ['1.1.1.1', '', '01-10-2026', '1', 'ja', 'Kantoor']], [], {}, zoek())
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen[0]).toEqual(KOP)
    expect(o.sheet.state.rijen[1]).toEqual(['1.1.1.1', '', '01-10-2026', '1', 'ja', 'Kantoor', 'label 1.1.1.1'])
  })

  it('schrijft de kop Herkomst ook rechts van een eigen kolom', async () => {
    const o = opzet([[...OUD_KOP, 'Notitie']], [], {}, zoek())
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen[0]).toEqual([...OUD_KOP, 'Notitie', 'Herkomst'])
  })

  it('vult een lege Herkomst en overschrijft een gevulde niet; Omschrijving en Toegestaan blijven', async () => {
    const lookup = zoek()
    const o = opzet([KOP,
      ['1.1.1.1', '', '01-10-2026', '1', 'ja', 'Kantoor', ''],
      ['2.2.2.2', '', '01-10-2026', '1', '', 'Thuis', 'Eigen tekst'],
      ['3.3.3.3', '', '01-10-2026', '1', 'nee', '', '  '],
    ], [], {}, lookup)
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen.slice(1)).toEqual([
      ['1.1.1.1', '', '01-10-2026', '1', 'ja', 'Kantoor', 'label 1.1.1.1'],
      ['2.2.2.2', '', '01-10-2026', '1', '', 'Thuis', 'Eigen tekst'],
      ['3.3.3.3', '', '01-10-2026', '1', 'nee', '', 'label 3.3.3.3'],
    ])
    expect(lookup).toHaveBeenCalledTimes(2)
    expect(lookup).not.toHaveBeenCalledWith('2.2.2.2')
  })

  it('doet hoogstens 10 lookups per run en vult de rest de volgende run', async () => {
    const lookup = zoek()
    const rijen = Array.from({ length: 12 }, (_, i) => [`10.0.0.${i}`, '', '01-10-2026', '1', '', '', ''])
    const o = opzet([KOP, ...rijen], [], {}, lookup)
    await syncToegang(NOW, o.deps)
    expect(lookup).toHaveBeenCalledTimes(10)
    expect(o.sheet.state.rijen.slice(1).filter((r) => r[6]).length).toBe(10)
    await syncToegang(NOW, o.deps)
    expect(lookup).toHaveBeenCalledTimes(12)
    expect(o.sheet.state.rijen.slice(1).every((r) => r[6])).toBe(true)
  })

  it('geeft bij een lookup-fout een lege cel en de run gaat door', async () => {
    const lookup = vi.fn(async (netwerk: string) => {
      if (netwerk === '1.1.1.1') throw new Error('stuk')
      return null
    })
    const o = opzet([KOP, ['1.1.1.1', '', '01-09-2026', '1', '', '', ''], ['2.2.2.2', '', '01-09-2026', '1', '', '', '']],
      [k('2026-10-01', '1.1.1.1'), k('2026-10-01', '9.9.9.9')], {}, lookup)
    const res = await syncToegang(NOW, o.deps)
    expect(res).toMatchObject({ nieuw: 1, bijgewerkt: 1 })
    expect(o.sheet.state.rijen.map((r) => r[6])).toEqual(['Herkomst', '', '', ''])
    expect(o.netwerken.over.size).toBe(0)
  })

  it('geeft nieuwe rijen direct een Herkomst, en schrijft die in dezelfde append', async () => {
    const o = opzet([KOP], [k('2026-10-01', '3.80.1.1')], {}, zoek())
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.rijen[1]).toEqual(['3.80.1.1', '01-10-2026', '01-10-2026', '1', '', '', 'label 3.80.1.1'])
    expect(o.sheet.state.aanroepen).toEqual(['sheetId', 'lees', 'voegToe'])
  })

  it('past de veilige volgorde toe: cellen, verwijderen, toevoegen', async () => {
    const o = opzet([KOP,
      ['oud', '', '01-01-2026', '3', '', '', ''],
      ['1.1.1.1', '01-09-2026', '01-09-2026', '1', 'ja', '', ''],
    ], [k('2026-10-01', '7.7.7.7')], {}, zoek())
    await syncToegang(NOW, o.deps)
    expect(o.sheet.state.aanroepen).toEqual(['sheetId', 'lees', 'schrijf', 'verwijderRijen', 'voegToe'])
  })

  it('doet niets met Herkomst als de kop niet te schrijven is', async () => {
    const o = opzet([OUD_KOP, ['1.1.1.1', '', '01-10-2026', '1', '', '']], [], { schrijf: true }, zoek())
    await expect(syncToegang(NOW, o.deps)).resolves.not.toBeNull()
    expect(o.sheet.state.rijen[1]).toHaveLength(6)
  })
})

describe('leesDatum', () => {
  it('leest de drie notaties en weigert onzin', () => {
    expect(leesDatum('02-10-2026')).toBe('2026-10-02')
    expect(leesDatum('2-10-2026')).toBe('2026-10-02')
    expect(leesDatum('2026-10-02')).toBe('2026-10-02')
    expect(leesDatum('46297')).toBe('2026-10-02')
    expect(leesDatum('31-02-2026')).toBeNull()
    expect(leesDatum('')).toBeNull()
    expect(leesDatum('gisteren')).toBeNull()
  })
})

describe('sync-toegang (geplande functie)', () => {
  it('doet niets als de env ontbreekt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    delete process.env.GOOGLE_TOEGANG_SHEET_ID
    process.env.GOOGLE_SA_EMAIL = 'sa@x'
    process.env.GOOGLE_SA_PRIVATE_KEY = 'key'
    const res = await syncHandler()
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(blobs.getStore).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
