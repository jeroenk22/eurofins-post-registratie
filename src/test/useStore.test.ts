import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStore, saveDraft, newEntry } from "../useStore";

const SESSION_KEY = 'form_draft';

describe("newEntry", () => {
  it("creates an entry with default values", () => {
    const entry = newEntry();
    expect(entry.shelf).toBeNull();
    expect(entry.shelfDescription).toBe('');
    expect(entry.name).toBe("");
    expect(entry.colli).toBe(1);
    expect(entry.spoed).toBe(false);
    expect(entry.photos).toEqual([]);
  });

  it("generates unique ids", () => {
    const ids = Array.from({ length: 20 }, () => newEntry().id);
    expect(new Set(ids).size).toBe(20);
  });
});

describe("useStore", () => {
  beforeEach(() => sessionStorage.clear());

  it("starts with one empty entry", () => {
    const { result } = renderHook(() => useStore());
    expect(result.current.entries).toHaveLength(1);
  });

  it("addEntry adds a new entry", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.addEntry());
    expect(result.current.entries).toHaveLength(2);
  });

  it("removeEntry removes the correct entry", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.addEntry());
    const idToRemove = result.current.entries[0].id;
    act(() => result.current.removeEntry(idToRemove));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).not.toBe(idToRemove);
  });

  it("updateEntry patches only the specified entry", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.addEntry());
    const [first, second] = result.current.entries;
    act(() => result.current.updateEntry(first.id, { name: "Acme", colli: 3 }));
    expect(result.current.entries[0].name).toBe("Acme");
    expect(result.current.entries[0].colli).toBe(3);
    expect(result.current.entries[1].id).toBe(second.id);
  });

  it("updateEntry updates shelf per entry", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.addEntry());
    const [first, second] = result.current.entries;
    act(() => result.current.updateEntry(first.id, { shelf: 3 }));
    act(() => result.current.updateEntry(second.id, { shelf: 7 }));
    expect(result.current.entries[0].shelf).toBe(3);
    expect(result.current.entries[1].shelf).toBe(7);
  });

  it("updateEntry supports 'overig' shelf with description", () => {
    const { result } = renderHook(() => useStore());
    const [entry] = result.current.entries;
    act(() => result.current.updateEntry(entry.id, { shelf: 'overig', shelfDescription: 'Ligt op kar naast de stelling' }));
    expect(result.current.entries[0].shelf).toBe('overig');
    expect(result.current.entries[0].shelfDescription).toBe('Ligt op kar naast de stelling');
  });

  it("shelfDescription blijft bewaard wanneer terug naar ander schap", () => {
    const { result } = renderHook(() => useStore());
    const [entry] = result.current.entries;
    act(() => result.current.updateEntry(entry.id, { shelf: 'overig', shelfDescription: 'Ligt op kar naast de stelling' }));
    act(() => result.current.updateEntry(entry.id, { shelf: 1 }));
    expect(result.current.entries[0].shelf).toBe(1);
    expect(result.current.entries[0].shelfDescription).toBe('Ligt op kar naast de stelling');
  });

  it("reset clears all state", () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.addEntry();
      result.current.setSenderName("Sophie");
      result.current.setSenderPhone("0612345678");
      result.current.setSenderEmail("sophie@example.com");
      result.current.reset();
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.senderName).toBe("");
    expect(result.current.senderPhone).toBe("");
    expect(result.current.senderEmail).toBe("");
  });
});

describe("useStore — sessionStorage persistentie", () => {
  beforeEach(() => sessionStorage.clear());

  it("slaat state op in sessionStorage na wijziging", async () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.setSenderName("Sophie"));
    const draft = JSON.parse(sessionStorage.getItem(SESSION_KEY)!);
    expect(draft.senderName).toBe("Sophie");
  });

  it("herstelt state uit sessionStorage bij mount (page reload simulatie)", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      entries: [{ id: "x1", shelf: 2, shelfDescription: "", name: "Acme", adres: "", postcode: "", plaats: "", land: "", colli: 3, spoed: false, photos: [] }],
      senderName: "Sophie",
      senderPhone: "0612345678",
      senderEmail: "sophie@example.com",
    }));
    const { result } = renderHook(() => useStore());
    expect(result.current.senderName).toBe("Sophie");
    expect(result.current.entries[0].name).toBe("Acme");
    expect(result.current.entries[0].colli).toBe(3);
  });

  it("reset schrijft lege state naar sessionStorage", () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.setSenderName("Sophie");
      result.current.addEntry();
    });
    act(() => result.current.reset());
    const draft = JSON.parse(sessionStorage.getItem(SESSION_KEY)!);
    expect(draft.senderName).toBe("");
    expect(draft.entries).toHaveLength(1);
  });

  it("slaat stilletjes op zonder foto's als quota wordt overschreden", () => {
    const store: Record<string, string> = {};
    let callCount = 0;
    const mockStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        // Eerste poging gooit QuotaExceededError; retry (zonder foto's) slaagt
        if (callCount++ === 0) throw new DOMException("quota", "QuotaExceededError");
        store[k] = v;
      },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    };
    const originalStorage = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', { value: mockStorage, configurable: true });

    try {
      const state = {
        entries: [{ ...newEntry(), photos: [{ id: "p1", name: "foto.jpg", data: "data:image/jpeg;base64,abc" }] }],
        senderName: "Sophie",
        senderPhone: "",
        senderEmail: "",
      };
      saveDraft(state);
      const saved = JSON.parse(store[SESSION_KEY]);
      expect(saved.entries[0].photos).toHaveLength(0); // foto gestript
      expect(saved.senderName).toBe("Sophie");         // rest bewaard
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: originalStorage, configurable: true });
    }
  });
});
