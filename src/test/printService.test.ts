import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  LABEL_FORMATS,
  getSelectedFormat,
  setSelectedFormat,
  encodePrintData,
  decodePrintData,
  printLabels,
  formatOrderDateTime,
  type PrintEntry,
} from "../services/printService";

const sampleEntries: PrintEntry[] = [
  { name: "Jan de Vries", adres: "Hoofdstraat 1", postcode: "1234 AB", plaats: "Amsterdam", land: "Nederland", route: "Route 3", colli: 2, colliOmschrijvingen: [], spoed: false },
  { name: "Acme B.V.", adres: "", postcode: "", plaats: "", land: "", route: "Overig: koeling", colli: 1, colliOmschrijvingen: [], spoed: true },
];

describe("printLabels — colli omschrijving op label", () => {
  const format = LABEL_FORMATS.find(f => f.id === 'brother_dk11208')!
  let writtenHtml: string

  beforeEach(() => {
    const mockDoc = { write: vi.fn((html: string) => { writtenHtml = html }), close: vi.fn() }
    const mockWin = { document: mockDoc, focus: vi.fn(), print: vi.fn(), close: vi.fn() }
    vi.stubGlobal('open', vi.fn().mockReturnValue(mockWin))
  })

  afterEach(() => vi.unstubAllGlobals())

  it("toont omschrijving op het label als die ingevuld is", () => {
    const entries: PrintEntry[] = [
      { name: "Jan", adres: "", postcode: "", plaats: "", land: "", route: "", colli: 1, colliOmschrijvingen: ["doos grond"], spoed: false },
    ]
    printLabels(entries, format)
    expect(writtenHtml).toContain("doos grond")
  })

  it("toont geen omschrijving-div als die leeg is", () => {
    const entries: PrintEntry[] = [
      { name: "Jan", adres: "", postcode: "", plaats: "", land: "", route: "", colli: 1, colliOmschrijvingen: [""], spoed: false },
    ]
    printLabels(entries, format)
    expect(writtenHtml).not.toContain('class="omschrijving"')
  })

  it("plaatst de juiste omschrijving op elk collo-label", () => {
    const entries: PrintEntry[] = [
      { name: "Jan", adres: "", postcode: "", plaats: "", land: "", route: "", colli: 2, colliOmschrijvingen: ["doos A", "buis B"], spoed: false },
    ]
    printLabels(entries, format)
    expect(writtenHtml).toContain("doos A")
    expect(writtenHtml).toContain("buis B")
  })

  it("escapet HTML-tekens in de omschrijving", () => {
    const entries: PrintEntry[] = [
      { name: "Jan", adres: "", postcode: "", plaats: "", land: "", route: "", colli: 1, colliOmschrijvingen: ["<script>alert(1)</script>"], spoed: false },
    ]
    printLabels(entries, format)
    expect(writtenHtml).not.toContain("<script>")
    expect(writtenHtml).toContain("&lt;script&gt;")
  })
})

describe("formatOrderDateTime", () => {
  it("formatteert een ISO-tijdstip als dd-mm-jjjj uu:mm in Nederlandse tijd", () => {
    // 12:07 UTC in de zomer = 14:07 in Nederland (CEST)
    expect(formatOrderDateTime("2026-08-31T12:07:00.000Z")).toBe("31-08-2026 14:07")
  })

  it("gebruikt wintertijd buiten de zomertijd", () => {
    // 12:07 UTC in de winter = 13:07 in Nederland (CET)
    expect(formatOrderDateTime("2026-01-15T12:07:00.000Z")).toBe("15-01-2026 13:07")
  })

  it("toont middernacht als 00:xx en niet als 24:xx", () => {
    expect(formatOrderDateTime("2026-01-14T23:05:00.000Z")).toBe("15-01-2026 00:05")
  })

  it("geeft een lege string bij een ontbrekende of ongeldige waarde", () => {
    expect(formatOrderDateTime(undefined)).toBe("")
    expect(formatOrderDateTime("")).toBe("")
    expect(formatOrderDateTime("geen datum")).toBe("")
  })
})

describe("printLabels — order datum/tijd op het label", () => {
  let writtenHtml: string

  beforeEach(() => {
    const mockDoc = { write: vi.fn((html: string) => { writtenHtml = html }), close: vi.fn() }
    const mockWin = { document: mockDoc, focus: vi.fn(), print: vi.fn(), close: vi.fn() }
    vi.stubGlobal('open', vi.fn().mockReturnValue(mockWin))
  })
  afterEach(() => vi.unstubAllGlobals())

  const makeEntry = (overrides: Partial<PrintEntry> = {}): PrintEntry => ({
    name: "Jan", adres: "", postcode: "", plaats: "", land: "", route: "", colli: 1,
    colliOmschrijvingen: [""], spoed: false, ...overrides,
  })

  it("toont de datum/tijd op elk labelformaat", () => {
    for (const format of LABEL_FORMATS) {
      printLabels([makeEntry({ orderedAt: "2026-08-31T12:07:00.000Z" })], format)
      expect(writtenHtml, `formaat ${format.id}`).toContain('class="datum"')
      expect(writtenHtml, `formaat ${format.id}`).toContain("31-08-2026 14:07")
    }
  })

  it("toont dezelfde datum op elk collo-label", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'brother_dk11208')!
    printLabels([makeEntry({ colli: 3, colliOmschrijvingen: ["a", "b", "c"], orderedAt: "2026-08-31T12:07:00.000Z" })], format)
    expect(writtenHtml.match(/31-08-2026 14:07/g)).toHaveLength(3)
  })

  it("laat de datumregel weg als er geen tijdstip bekend is", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'brother_dk11208')!
    printLabels([makeEntry()], format)
    expect(writtenHtml).not.toContain('class="datum"')
  })

  it("gebruikt kleinere letters op het tussenformaat 57×32, zodat de datumregel binnen de rand valt", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'dymo_11354')! // 57×32mm
    printLabels([makeEntry({ orderedAt: "2026-08-31T12:07:00.000Z" })], format)
    // Het middelgrote lettertype (15pt naam) liep op dit formaat over de onderrand
    expect(writtenHtml).toContain('font-size: 12pt')
    expect(writtenHtml).not.toContain('font-size: 15pt')
    expect(writtenHtml).toContain('padding: 2mm 4mm')
  })

  it("kapt een lange naam af zonder de datum te verdringen", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'dymo_11352')! // krapste formaat
    printLabels([makeEntry({
      name: "Loonbedrijf Van der Meer en Zonen Vennootschap",
      plaats: "Sint Nicolaasga bij Langweer",
      orderedAt: "2026-08-31T12:07:00.000Z",
    })], format)
    expect(writtenHtml).toContain("31-08-2026 14:07")
    expect(writtenHtml).toContain("text-overflow: ellipsis")
  })
})

describe("encodePrintData / decodePrintData", () => {
  it("round-trips correctly", () => {
    const encoded = encodePrintData(sampleEntries);
    expect(decodePrintData(encoded)).toEqual(sampleEntries);
  });

  it("returns URL-safe string (no unencoded brackets or quotes)", () => {
    const encoded = encodePrintData(sampleEntries);
    expect(encoded).not.toContain("[");
    expect(encoded).not.toContain('"');
  });

  it("returns null for invalid JSON", () => {
    expect(decodePrintData("dit-is-geen-json")).toBeNull();
  });

  it("returns null when decoded value is not an array", () => {
    const notAnArray = encodeURIComponent(JSON.stringify({ foo: "bar" }));
    expect(decodePrintData(notAnArray)).toBeNull();
  });

  it("handles empty array", () => {
    expect(decodePrintData(encodePrintData([]))).toEqual([]);
  });
});

describe("getSelectedFormat / setSelectedFormat", () => {
  beforeEach(() => localStorage.clear());

  it("returns the default format when nothing is stored", () => {
    const format = getSelectedFormat();
    expect(format.id).toBe("brother_dk11208");
  });

  it("returns the stored format after setSelectedFormat", () => {
    setSelectedFormat("brother_dk11201");
    expect(getSelectedFormat().id).toBe("brother_dk11201");
  });

  it("falls back to default for an unknown stored id", () => {
    localStorage.setItem("label_format", "onbekend_formaat");
    expect(getSelectedFormat().id).toBe("brother_dk11208");
  });
});

describe("printLabels — mestklant kort label op kleine etiketten", () => {
  const makeEntry = (omschrijving: string) => ({
    name: "Bakker", adres: "", postcode: "", plaats: "", land: "", route: "", colli: 1,
    colliOmschrijvingen: [omschrijving], spoed: false,
  })

  beforeEach(() => {
    vi.stubGlobal("window", { open: vi.fn().mockReturnValue({ document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn(), close: vi.fn() }) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("toont het volle label op het standaard formaat (38mm)", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'brother_dk11208')! // 38×90mm
    printLabels([makeEntry('Eijkelkamp deksels')], format)
    const writtenHtml = (window.open as ReturnType<typeof vi.fn>).mock.results[0].value.document.write.mock.calls[0][0] as string
    expect(writtenHtml).toContain('Eijkelkamp deksels')
    expect(writtenHtml).not.toContain('Deksels</span>')
  })

  it("toont het korte label op een klein formaat (< 38mm)", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'brother_dk11201')! // 29×90mm
    printLabels([makeEntry('Eijkelkamp deksels')], format)
    const writtenHtml = (window.open as ReturnType<typeof vi.fn>).mock.results[0].value.document.write.mock.calls[0][0] as string
    expect(writtenHtml).toContain('Deksels')
  })

  it("mapt alle mestklant-labels correct naar het korte label", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'brother_dk11201')! // 29×90mm
    const cases: [string, string][] = [
      ['Eijkelkamp deksels',      'Deksels'],
      ['D-Tech (KLEINE DOOS)',        'D-Tech (KLEINE DOOS)'],
      ['D-Tech (GROTE DOOS)',         'D-Tech (GROTE DOOS)'],
      ['Vaste mestzakken (500st)', 'Vaste mestzakken (500st)'],
      ['Vaste mestzakken (50st)',  'Vaste mestzakken (50st)'],
    ]
    // window.open retourneert steeds hetzelfde mock-object; document.write accumuleert per aanroep
    const getDocWrite = () => (window.open as ReturnType<typeof vi.fn>).mock.results[0].value.document.write as ReturnType<typeof vi.fn>
    for (let i = 0; i < cases.length; i++) {
      const [label, shortLabel] = cases[i]
      printLabels([makeEntry(label)], format)
      const writtenHtml = getDocWrite().mock.calls[i][0] as string
      expect(writtenHtml, `label "${label}"`).toContain(shortLabel)
    }
  })

  it("laat vrije tekst ongewijzigd op kleine etiketten (geen mapping)", () => {
    const format = LABEL_FORMATS.find(f => f.id === 'brother_dk11201')! // 29×90mm
    printLabels([makeEntry('Speciaal pakket')], format)
    const writtenHtml = (window.open as ReturnType<typeof vi.fn>).mock.results[0].value.document.write.mock.calls[0][0] as string
    expect(writtenHtml).toContain('Speciaal pakket')
  })
})

describe("LABEL_FORMATS", () => {
  it("bevat DYMO en Brother formaten", () => {
    const ids = LABEL_FORMATS.map((f) => f.id);
    expect(ids.some((id) => id.startsWith("dymo_"))).toBe(true);
    expect(ids.some((id) => id.startsWith("brother_"))).toBe(true);
  });

  it("elk formaat heeft positieve afmetingen", () => {
    for (const f of LABEL_FORMATS) {
      expect(f.widthMm).toBeGreaterThan(0);
      expect(f.heightMm).toBeGreaterThan(0);
    }
  });
});
