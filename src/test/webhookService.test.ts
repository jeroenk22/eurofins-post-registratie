import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isWebhookConfigured, submitToWebhook } from "../webhookService";
import type { PostEntry } from "../types";

const makeEntry = (overrides: Partial<PostEntry> = {}): PostEntry => ({
  id: "test-1",
  shelf: 3,
  name: "Acme B.V.",
  colli: 2,
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

    // Foto's krijgen recipient en spoed mee zodat Make's foto-iterator
    // deze waarden beschikbaar heeft in geneste sub-routes (zie webhookService.ts)
    const foto = body.entries[0].photos[0];
    expect(foto.recipient).toBe("Jan de Vries");
    expect(foto.spoed).toBe(true);
    expect(foto.filename).toBe("foto_1.jpg");
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
});
