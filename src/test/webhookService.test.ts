import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isWebhookConfigured, submitToWebhook } from "../webhookService";
import { decodePrintData } from "../services/printService";
import type { PostEntry } from "../types";

// De payload gebruikt de servertijd, niet de klok van de werkplek.
const klok = vi.hoisted(() => ({ now: "2026-08-31T11:14:00.000Z" }));
vi.mock("../services/serverTime", () => ({
  serverNow: () => new Date(klok.now),
}));

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
    await expect(submitToWebhook([], "Sophie", "", "", "")).rejects.toThrow(
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

    await submitToWebhook(entries, "Sophie", "", "sophie@example.com", "");

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.total_entries).toBe(2);
    expect(body.entries[0].shelf).toBe("Schap 2");
    expect(body.entries[1].shelf).toBe("Schap 5");
    expect(body.entries[0].spoed).toBe(true);
    expect(body.sender_email).toBe("sophie@example.com");
    expect(body.cc_email).toBeNull();
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
    expect(foto.base64).toBe("data:image/jpeg;base64,abc123");
  });

  it("strips IMTString prefix from photo base64 data", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({
      photos: [
        { id: "p1", name: "foto.jpg", data: "IMTString(477367): data:image/jpeg;base64,/9j/abc" },
      ],
    });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].photos[0].base64).toBe("data:image/jpeg;base64,/9j/abc");
  });

  it("laat schone base64 data ongewijzigd", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({
      photos: [
        { id: "p1", name: "foto.jpg", data: "data:image/jpeg;base64,/9j/clean" },
      ],
    });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].photos[0].base64).toBe("data:image/jpeg;base64,/9j/clean");
  });

  it("verwerkt speciale tekens zoals ë in velden correct", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({
      name: "Müller GmbH",
      adres: "Rue de l'Église 12",
      plaats: "Liège",
      land: "België",
    });
    await submitToWebhook([entry], "Søren", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.sender_name).toBe("Søren");
    expect(body.entries[0].recipient).toBe("Müller GmbH");
    expect(body.entries[0].adres).toBe("Rue de l'Église 12");
    expect(body.entries[0].plaats).toBe("Liège");
    expect(body.entries[0].land).toBe("België");
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

  it("maps empty phone/email/cc to null", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "Sophie", "", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.sender_phone).toBeNull();
    expect(body.sender_email).toBeNull();
    expect(body.cc_email).toBeNull();
  });

  it("stuurt cc_email mee in de payload", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "Sophie", "", "", "cc@example.com");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.cc_email).toBe("cc@example.com");
  });

  it("trimt whitespace van cc_email en mapt lege string naar null", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "Sophie", "", "", "  cc@example.com  ");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.cc_email).toBe("cc@example.com");
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

  it.each([
    ['Monsternemers', 'monsternemer'],
    ['AP06', 'ap06'],
    ['Mestklanten', 'mestklant'],
  ])("mapt recipientType '%s' naar '%s' in recipient_type", async (raw, expected) => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({ recipientType: raw as PostEntry['recipientType'] });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].recipient_type).toBe(expected);
  });

  it("stuurt recipient_type als null als recipientType niet ingesteld is", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({ recipientType: undefined });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].recipient_type).toBeNull();
  });

  it("stuurt adresgegevens mee per entry", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({ adres: 'Kerkstraat 1a', postcode: '1234AB', plaats: 'Zevenbergen', land: 'Nederland' });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].adres).toBe('Kerkstraat 1a');
    expect(body.entries[0].postcode).toBe('1234AB');
    expect(body.entries[0].plaats).toBe('Zevenbergen');
    expect(body.entries[0].land).toBe('Nederland');
  });

  it("roept forward-webhook proxy aan naast Make.com webhook", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => url as string);
    expect(urls).toContain("/.netlify/functions/forward-webhook");
  });

  it("stuurt dezelfde payload naar Make.com en de forward-webhook proxy", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const calls = vi.mocked(fetch).mock.calls;
    const makeBody = (calls.find(([url]) => (url as string).includes("make.com"))?.[1] as RequestInit)?.body;
    const proxyBody = (calls.find(([url]) => (url as string).includes("forward-webhook"))?.[1] as RequestInit)?.body;
    expect(makeBody).toBeDefined();
    expect(proxyBody).toBeDefined();
    expect(proxyBody).toBe(makeBody);
  });

  it("stuurt adresgegevens als null bij lege velden", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const entry = makeEntry({ adres: '', postcode: '', plaats: '', land: '' });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].adres).toBeNull();
    expect(body.entries[0].postcode).toBeNull();
    expect(body.entries[0].plaats).toBeNull();
    expect(body.entries[0].land).toBeNull();
  });

  it("stuurt app_version mee in de payload", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(typeof body.app_version).toBe("string");
    expect(body.app_version.length).toBeGreaterThan(0);
  });

  it("gooit een fout bij een niet-ok HTTP-response van de hoofdwebhook", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" }));
    await expect(submitToWebhook([makeEntry()], "Sophie", "", "")).rejects.toThrow("HTTP 500");
  });

  it("gooit geen fout als alleen de forward-webhook proxy mislukt", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true })   // hoofdwebhook slaagt
      .mockRejectedValueOnce(new Error("proxy down")) // proxy faalt
    );
    await expect(submitToWebhook([makeEntry()], "Sophie", "", "")).resolves.toEqual(expect.any(String));
  });

  it("geeft het verzendtijdstip terug dat ook in de payload staat", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const sentAt = await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(sentAt).toBe(body.submitted_at);
  });

  it("zet het verzendtijdstip in de print-link zodat het op de labels komt", async () => {
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
    const sentAt = await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    const encoded = new URL(body.print_url).searchParams.get("printData")!;
    const printEntries = decodePrintData(encoded)!;
    expect(printEntries[0].orderedAt).toBe(sentAt);
  });
});

describe("submitToWebhook — tijdstip komt van de server, in Nederlandse tijd", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    vi.stubEnv("VITE_WEBHOOK_URL", "https://hook.eu2.make.com/test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    klok.now = "2026-08-31T11:14:00.000Z";
  });

  const payload = () =>
    JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);

  it("gebruikt de servertijd voor submitted_at, datetime_nl en de sticker", async () => {
    // Werkplekklok loopt 9 minuten voor; de server zegt 11:14 UTC
    klok.now = "2026-08-31T11:14:00.000Z";
    vi.setSystemTime(new Date("2026-08-31T11:23:00.000Z"));

    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = payload();

    expect(body.submitted_at).toBe("2026-08-31T11:14:00.000Z");
    expect(body.datetime_nl).toContain("13:14");
    expect(body.datetime_nl).not.toContain("13:23");

    const encoded = new URL(body.print_url).searchParams.get("printData")!;
    expect(decodePrintData(encoded)![0].orderedAt).toBe("2026-08-31T11:14:00.000Z");

    vi.useRealTimers();
  });

  it("rekent datetime_nl om naar Nederlandse zomertijd (CEST, UTC+2)", async () => {
    klok.now = "2026-08-31T11:14:00.000Z";
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    expect(payload().datetime_nl).toContain("13:14");
  });

  it("rekent datetime_nl om naar Nederlandse wintertijd (CET, UTC+1)", async () => {
    klok.now = "2026-01-15T11:14:00.000Z";
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    expect(payload().datetime_nl).toContain("12:14");
  });
});
