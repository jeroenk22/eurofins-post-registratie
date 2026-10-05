import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitToWebhook, resubmitToMake, SubmitError } from "../webhookService";
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

describe("submitToWebhook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls fetch with correct payload shape", async () => {
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
    expect(body.print_url).not.toContain("printData");
    expect(body.print_url).toBe(`http://localhost:3000/?s=${body.submission_id}`);
    expect(body.fotos_url).toBe(`http://localhost:3000/?fotos=${body.submission_id}`);
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
    const entry = makeEntry({ shelf: 'overig', shelfDescription: 'Ligt op kar naast de stelling' });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].shelf).toBe("Overig: Ligt op kar naast de stelling");
  });

  it("maps empty phone/email/cc to null", async () => {
    await submitToWebhook([makeEntry()], "Sophie", "", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.sender_phone).toBeNull();
    expect(body.sender_email).toBeNull();
    expect(body.cc_email).toBeNull();
  });

  it("stuurt cc_email mee in de payload", async () => {
    await submitToWebhook([makeEntry()], "Sophie", "", "", "cc@example.com");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.cc_email).toBe("cc@example.com");
  });

  it("trimt whitespace van cc_email en mapt lege string naar null", async () => {
    await submitToWebhook([makeEntry()], "Sophie", "", "", "  cc@example.com  ");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.cc_email).toBe("cc@example.com");
  });

  it("trims whitespace from sender fields", async () => {
    await submitToWebhook([makeEntry()], "  Sophie  ", " 0612345678 ", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.sender_name).toBe("Sophie");
    expect(body.sender_phone).toBe("0612345678");
  });

  it("mapt mestklant-labels naar TMS-waarden in colli_omschrijvingen", async () => {
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
    const entry = makeEntry({ recipientType: raw as PostEntry['recipientType'] });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].recipient_type).toBe(expected);
  });

  it("stuurt recipient_type als null als recipientType niet ingesteld is", async () => {
    const entry = makeEntry({ recipientType: undefined });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].recipient_type).toBeNull();
  });

  it("stuurt adresgegevens mee per entry", async () => {
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
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => url as string);
    expect(urls).toContain("/.netlify/functions/forward-webhook");
  });

  it("stuurt dezelfde payload naar Make.com en de forward-webhook proxy, op de labels na", async () => {
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const calls = vi.mocked(fetch).mock.calls;
    const makeBody = (calls.find(([url]) => (url as string).includes("naar-make"))?.[1] as RequestInit)?.body;
    const proxyBody = (calls.find(([url]) => (url as string).includes("forward-webhook"))?.[1] as RequestInit)?.body;
    expect(makeBody).toBeDefined();
    expect(proxyBody).toBeDefined();
    const { labels, ...zonderLabels } = JSON.parse(makeBody as string);
    expect(labels).toHaveLength(1);
    expect(JSON.parse(proxyBody as string)).toEqual(zonderLabels);
  });

  it("stuurt adresgegevens als null bij lege velden, en land als Nederland", async () => {
    const entry = makeEntry({ adres: '', postcode: '', plaats: '', land: '' });
    await submitToWebhook([entry], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.entries[0].adres).toBeNull();
    expect(body.entries[0].postcode).toBeNull();
    expect(body.entries[0].plaats).toBeNull();
    // null liet create-order crashen en daarmee de hele aanmelding
    expect(body.entries[0].land).toBe("Nederland");
  });

  it("stuurt app_version mee in de payload", async () => {
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(typeof body.app_version).toBe("string");
    expect(body.app_version.length).toBeGreaterThan(0);
  });

  it("gooit een fout bij een niet-ok HTTP-response van de hoofdwebhook", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" }));
    await expect(submitToWebhook([makeEntry()], "Sophie", "", "")).rejects.toThrow("HTTP 500");
  });

  it("gooit geen fout als alleen de forward-webhook proxy mislukt", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true })   // hoofdwebhook slaagt
      .mockRejectedValueOnce(new Error("proxy down")) // proxy faalt
    );
    await expect(submitToWebhook([makeEntry()], "Sophie", "", "")).resolves.toEqual({
      submittedAt: expect.any(String),
      orderIds: [],
      submissionId: expect.any(String),
    });
  });

  it("geeft het verzendtijdstip terug dat ook in de payload staat", async () => {
    const { submittedAt: sentAt } = await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(sentAt).toBe(body.submitted_at);
  });

  it("zet het verzendtijdstip in de labels naar naar-make zodat het op de labels komt", async () => {
    const { submittedAt: sentAt } = await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.labels[0].orderedAt).toBe(sentAt);
  });
});

describe("submitToWebhook — Mendrix order-ID's", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const forwardAntwoord = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });

  it("geeft de order-ID's uit het forward-webhook antwoord terug, per entry", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce(forwardAntwoord({ ok: true, status: 200, orderIds: ["1234567", null] })));
    const { orderIds } = await submitToWebhook([makeEntry(), makeEntry({ id: "test-2" })], "Sophie", "", "");
    expect(orderIds).toEqual(["1234567", null]);
  });

  it("geeft een lege lijst als de forward-webhook een fout geeft", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 502, json: () => Promise.resolve({ orderIds: ["1"] }) }));
    const { orderIds } = await submitToWebhook([makeEntry()], "Sophie", "", "");
    expect(orderIds).toEqual([]);
  });

  it("geeft een lege lijst als het antwoord geen geldige JSON is", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.reject(new SyntaxError("geen JSON")) }));
    const { orderIds } = await submitToWebhook([makeEntry()], "Sophie", "", "");
    expect(orderIds).toEqual([]);
  });

  it("zet dezelfde aanmeldingscode in de payload en in de print-link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.submission_id).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(new URL(body.print_url).searchParams.get("s")).toBe(body.submission_id);
    // Geen labelgegevens meer in de link
    expect(new URL(body.print_url).searchParams.get("printData")).toBeNull();
  });

  it("geeft de aanmeldingscode terug in het resultaat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const { submissionId } = await submitToWebhook([makeEntry()], "Sophie", "", "");
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(submissionId).toBe(body.submission_id);
  });

  it("stuurt labels alleen naar naar-make; forward-webhook krijgt dezelfde payload zonder labels", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    const calls = vi.mocked(fetch).mock.calls;
    const make = JSON.parse((calls.find(([u]) => (u as string).includes("naar-make"))![1] as RequestInit).body as string);
    const forward = JSON.parse((calls.find(([u]) => (u as string).includes("forward-webhook"))![1] as RequestInit).body as string);
    expect(make.labels).toEqual([expect.objectContaining({ name: "Acme B.V.", route: "Route 3", colli: 2 })]);
    expect("labels" in forward).toBe(false);
    const { labels: _labels, ...zonderLabels } = make;
    expect(forward).toEqual(zonderLabels);
  });

  it("maakt van onverwachte waarden null", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce(forwardAntwoord({ orderIds: [123, "", "42"] })));
    const { orderIds } = await submitToWebhook([makeEntry()], "Sophie", "", "");
    expect(orderIds).toEqual([null, null, "42"]);
  });
});

describe("submitToWebhook — tijdstip komt van de server, in Nederlandse tijd", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
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

    expect(body.labels[0].orderedAt).toBe("2026-08-31T11:14:00.000Z");

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

describe("submitToWebhook — geen tweede Mendrix-order na een mislukte poging", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /** fetch per URL: Make en forward-webhook lopen tegelijk, de volgorde ligt niet vast. */
  const stubFetch = (make: () => Promise<unknown>, forward: () => Promise<unknown>) =>
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("naar-make") ? make() : forward())));
  const metOrders = (ids: (string | null)[]) => () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, status: 200, orderIds: ids }) });
  const makeFaalt = () => Promise.resolve({ ok: false, status: 500, statusText: "Internal Server Error" });

  it("onthoudt payload en order-ID's als Make faalt maar de orders al bestaan", async () => {
    stubFetch(makeFaalt, metOrders(["1293793"]));
    const err = await submitToWebhook([makeEntry()], "Sophie", "", "").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SubmitError);
    expect((err as SubmitError).message).toContain("HTTP 500");
    const pending = (err as SubmitError).pending!;
    expect(pending.orderIds).toEqual(["1293793"]);
    expect(pending.payload.entries[0].recipient).toBe("Acme B.V.");
    // De labels blijven bij de pending, zodat een nieuwe poging ze opnieuw opslaat
    expect(pending.payload.labels).toEqual([expect.objectContaining({ name: "Acme B.V." })]);
  });

  it("ook als Make helemaal onbereikbaar is", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")), metOrders(["1293793"]));
    const err = await submitToWebhook([makeEntry()], "Sophie", "", "").catch((e: unknown) => e);
    expect((err as SubmitError).pending?.orderIds).toEqual(["1293793"]);
  });

  it("geen pending als er geen order is aangemaakt", async () => {
    stubFetch(makeFaalt, metOrders([null]));
    const err = await submitToWebhook([makeEntry()], "Sophie", "", "").catch((e: unknown) => e);
    expect((err as SubmitError).pending).toBeNull();
  });

  it("opnieuw proberen gaat alleen naar Make, met exact dezelfde payload", async () => {
    stubFetch(makeFaalt, metOrders(["1293793"]));
    const err = (await submitToWebhook([makeEntry()], "Sophie", "", "").catch((e: unknown) => e)) as SubmitError;
    const eersteBody = (vi.mocked(fetch).mock.calls.find(([u]) => (u as string).includes("naar-make"))![1] as RequestInit).body;

    stubFetch(() => Promise.resolve({ ok: true }), metOrders(["9999999"]));
    const result = await resubmitToMake(err.pending!);

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toContain("naar-make");
    expect((calls[0][1] as RequestInit).body).toBe(eersteBody);
    expect(result).toEqual({ submittedAt: err.pending!.payload.submitted_at, orderIds: ["1293793"], submissionId: err.pending!.payload.submission_id });
    expect(JSON.parse((calls[0][1] as RequestInit).body as string).labels).toHaveLength(1);
  });

  it("een mislukte nieuwe poging houdt de pending vast", async () => {
    stubFetch(makeFaalt, metOrders(["1293793"]));
    const err = (await submitToWebhook([makeEntry()], "Sophie", "", "").catch((e: unknown) => e)) as SubmitError;
    const again = await resubmitToMake(err.pending!).catch((e: unknown) => e);
    expect(again).toBeInstanceOf(SubmitError);
    expect((again as SubmitError).pending).toBe(err.pending);
  });
});

describe("submitToWebhook — mail per zending (desktop)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const body = () => JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);

  it("stuurt mail_versturen mee als de desktop het kiest", async () => {
    await submitToWebhook([makeEntry()], "Sophie", "", "", "", { mailVersturen: false });
    expect(body().mail_versturen).toBe(false);
  });

  it("laat het veld weg als niemand het kiest (telefoon), zodat Make mailt zoals altijd", async () => {
    await submitToWebhook([makeEntry()], "Sophie", "", "");
    expect("mail_versturen" in body()).toBe(false);
  });
});
