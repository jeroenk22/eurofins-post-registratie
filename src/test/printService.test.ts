import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  LABEL_FORMATS,
  getSelectedFormat,
  setSelectedFormat,
  encodePrintData,
  decodePrintData,
  printLabels,
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
