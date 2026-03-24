import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isWebhookConfigured, submitToWebhook } from "../webhookService";
import type { PostEntry } from "../types";

const makeEntry = (overrides: Partial<PostEntry> = {}): PostEntry => ({
  id: "test-1",
  shelf: 3,
  shelfDescription: '',
  name: "Acme B.V.",
  adres: '',
  postcode: '',
  plaats: '',
  land: '',
  colli: 2,
  colliOmschrijvingen: [],
  spoed: false,
  photos: [],
  ...overrides,
});

describe("isWebhookConfigured", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns false when VITE_WEBHOOK_URL is empty", () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "");
    expect(isWebhookConfigured()).toBe(false);
  });

  it("returns true when VITE_WEBHOOK_URL is set", () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    expect(isWebhookConfigured()).toBe(true);
  });
});

describe("submitToWebhook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("throws when webhook URL is not configured", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "");
    await expect(submitToWebhook([], "Sophie", "", "")).rejects.toThrow(
      "VITE_WEBHOOK_URL is niet ingesteld",
    );
  });

  it("calls fetch with correct payload shape", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entries: PostEntry[] = [
      makeEntry({
        shelf: 2,
        name: "Jan de Vries",
        colli: 1,
        spoed: true,
        photos: [
          {
            id: "p1",
            name: "foto_1.jpg",
            data: "data:image/jpeg;base64,abc123",
          },
        ],
      }),
      makeEntry({
        id: "test-2",
        shelf: 5,
        name: "Acme B.V.",
        colli: 3,
        spoed: false,
      }),
    ];

    await submitToWebhook(entries, "Sophie", "", "sophie@example.com");

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.total_entries).toBe(2);
    expect(body.entries[0].shelf).toBe("Schap 2");
    expect(body.entries[1].shelf).toBe("Schap 5");
    expect(body.entries[0].spoed).toBe(true);
    expect(body.sender_email).toBe("sophie@example.com");
    expect(body.sender_phone).toBeNull();
    expect(typeof body.print_url).toBe("string");
    expect(body.print_url).toContain("printData=");
    expect(body.entries[0].print_url).toBeUndefined();
    expect(body.entries[1].print_url).toBeUndefined();

    // Foto's krijgen recipient en spoed mee zodat Make's foto-iterator
    // deze waarden beschikbaar heeft in geneste sub-routes (zie webhookService.ts)
    const foto = body.entries[0].photos[0];
    expect(foto.recipient).toBe("Jan de Vries");
    expect(foto.spoed).toBe(true);
    expect(foto.filename).toBe("foto_1.jpg");
  });

  it("stuurt colli_omschrijvingen mee in de payload", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entries: PostEntry[] = [
      makeEntry({ colli: 2, colliOmschrijvingen: ["doos grond", "buis"] }),
      makeEntry({ id: "test-2", colli: 1, colliOmschrijvingen: [] }),
    ];
    await submitToWebhook(entries, "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].colli_omschrijvingen).toEqual(["doos grond", "buis"]);
    expect(body.entries[1].colli_omschrijvingen).toEqual([]);
  });

  it("formats overig shelf with description prefix", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({ shelf: 'overig', shelfDescription: 'Ligt op kar naast de stelling' });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].shelf).toBe("Overig: Ligt op kar naast de stelling");
  });

  it("maps empty phone/email to null", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.sender_phone).toBeNull();
    expect(body.sender_email).toBeNull();
  });

  it("trims whitespace from sender fields", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "  Sophie  ", " 0612345678 ", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.sender_name).toBe("Sophie");
    expect(body.sender_phone).toBe("0612345678");
  });

  it("mapt mestklant-labels naar TMS-waarden in colli_omschrijvingen", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({
      recipientType: 'Mestklanten',
      colli: 3,
      colliOmschrijvingen: ['Eijkelkamp deksels', 'D-Tech (KLEINE DOOS)', 'Vrij getypt pakket'],
    });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].colli_omschrijvingen).toEqual([
      'Doos deksels',
      'Doosje sealrollen',
      'Vrij getypt pakket',   // "Anders..."-waarde: geen mapping, pass-through
    ]);
  });

  it("raakt colli_omschrijvingen niet aan bij niet-mestklanten", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({
      recipientType: 'Monsternemers',
      colli: 1,
      colliOmschrijvingen: ['Eijkelkamp deksels'],
    });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].colli_omschrijvingen).toEqual(['Eijkelkamp deksels']);
  });
});
