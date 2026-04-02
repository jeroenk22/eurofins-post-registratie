import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwUpdateCheck } from "../hooks/useSwUpdateCheck";

const LAST_CHECK_KEY = "sw_last_update_check";

function mockServiceWorker(updateFn = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, "serviceWorker", {
    writable: true,
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue({ update: updateFn }),
    },
  });
  return updateFn;
}

function removeServiceWorker() {
  Object.defineProperty(navigator, "serviceWorker", {
    writable: true,
    configurable: true,
    value: undefined,
  });
}

// Flush pending promises/microtasks
const flushPromises = () => act(async () => {});

describe("useSwUpdateCheck", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("roept registration.update() aan bij opstarten als vandaag nog niet gecheckt", async () => {
    const update = mockServiceWorker();

    renderHook(() => useSwUpdateCheck());
    await flushPromises();

    expect(update).toHaveBeenCalledOnce();
  });

  it("slaat timestamp op in localStorage na update-check", async () => {
    mockServiceWorker();
    const before = Date.now();

    renderHook(() => useSwUpdateCheck());
    await flushPromises();

    const stored = parseInt(localStorage.getItem(LAST_CHECK_KEY) ?? "0", 10);
    expect(stored).toBeGreaterThanOrEqual(before);
  });

  it("roept registration.update() NIET aan bij opstarten als vandaag al gecheckt", async () => {
    const update = mockServiceWorker();
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

    renderHook(() => useSwUpdateCheck());
    await flushPromises();

    expect(update).not.toHaveBeenCalled();
  });

  it("roept registration.update() aan om 19:00", async () => {
    // Begin om 10:00, check al gedaan vandaag → opstartcheck wordt overgeslagen
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    vi.setSystemTime(now);
    localStorage.setItem(LAST_CHECK_KEY, now.getTime().toString());

    const update = mockServiceWorker();
    renderHook(() => useSwUpdateCheck());
    await flushPromises();
    expect(update).not.toHaveBeenCalled();

    // Spoel door naar 19:00 (9 uur vooruit)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9 * 60 * 60 * 1000);
    });

    expect(update).toHaveBeenCalledOnce();
  });

  it("roept registration.update() de volgende dag weer aan om 19:00", async () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    vi.setSystemTime(now);
    localStorage.setItem(LAST_CHECK_KEY, now.getTime().toString());

    const update = mockServiceWorker();
    renderHook(() => useSwUpdateCheck());
    await flushPromises();

    // Dag 1 — 19:00
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9 * 60 * 60 * 1000);
    });
    expect(update).toHaveBeenCalledTimes(1);

    // Dag 2 — nog eens 24 uur verder
    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("doet niets als serviceWorker niet beschikbaar is", async () => {
    removeServiceWorker();

    expect(() => renderHook(() => useSwUpdateCheck())).not.toThrow();
    await flushPromises();
  });

  it("slaat timestamp NIET op als reg.update() gooit en gooit geen unhandled rejection", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      writable: true,
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          update: vi.fn().mockRejectedValue(new Error("netwerk fout")),
        }),
      },
    });

    renderHook(() => useSwUpdateCheck());
    await flushPromises();

    // Timestamp mag niet opgeslagen zijn na een mislukte check
    expect(localStorage.getItem(LAST_CHECK_KEY)).toBeNull();
  });

  it("slaat timestamp NIET op als getRegistration() gooit", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      writable: true,
      configurable: true,
      value: {
        getRegistration: vi.fn().mockRejectedValue(new Error("SW fout")),
      },
    });

    renderHook(() => useSwUpdateCheck());
    await flushPromises();

    expect(localStorage.getItem(LAST_CHECK_KEY)).toBeNull();
  });

  it("cleanup cancelt de timer bij unmount", async () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    vi.setSystemTime(now);
    localStorage.setItem(LAST_CHECK_KEY, now.getTime().toString());

    const update = mockServiceWorker();
    const { unmount } = renderHook(() => useSwUpdateCheck());
    await flushPromises();

    unmount();

    // Na unmount mag de 19:00-timer niet meer afgaan
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9 * 60 * 60 * 1000);
    });

    expect(update).not.toHaveBeenCalled();
  });
});
