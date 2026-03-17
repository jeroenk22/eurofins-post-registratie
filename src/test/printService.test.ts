import { describe, it, expect, beforeEach } from "vitest";
import {
  LABEL_FORMATS,
  getSelectedFormat,
  setSelectedFormat,
  encodePrintData,
  decodePrintData,
  type PrintEntry,
} from "../services/printService";

const sampleEntries: PrintEntry[] = [
  { name: "Jan de Vries", schapnummer: "Schap 3", colli: 2 },
  { name: "Acme B.V.", schapnummer: "Overig: koeling", colli: 1 },
];

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
    expect(format.id).toBe("dymo_99010");
  });

  it("returns the stored format after setSelectedFormat", () => {
    setSelectedFormat("brother_dk11201");
    expect(getSelectedFormat().id).toBe("brother_dk11201");
  });

  it("falls back to default for an unknown stored id", () => {
    localStorage.setItem("label_format", "onbekend_formaat");
    expect(getSelectedFormat().id).toBe("dymo_99010");
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
