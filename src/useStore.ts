import { useState, useCallback, useEffect } from "react";
import type { PostEntry } from "./types";

const SESSION_KEY = 'form_draft';
// Afzendergegevens per werkplek: één keer invullen, daarna onthouden tot iemand
// iets anders invult. Daarom localStorage, niet het sessie-concept.
const SENDER_KEY = 'afzender';

let _counter = 0;
export const genId = (): string =>
  `e${++_counter}_${Math.random().toString(36).slice(2, 6)}`;

export function newEntry(): PostEntry {
  return {
    id: genId(),
    shelf: null,
    shelfDescription: '',
    name: "",
    adres: "",
    postcode: "",
    plaats: "",
    land: "",
    colli: 1,
    colliOmschrijvingen: [],
    spoed: false,
    photos: [],
  };
}

interface PersistedState {
  entries: PostEntry[];
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  senderCcEmail: string;
}

function loadDraft(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export interface SenderSettings {
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  senderCcEmail: string;
}

export function loadSender(): SenderSettings | null {
  try {
    const raw = localStorage.getItem(SENDER_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SenderSettings>;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      senderName: str(s.senderName),
      senderPhone: str(s.senderPhone),
      senderEmail: str(s.senderEmail),
      senderCcEmail: str(s.senderCcEmail),
    };
  } catch {
    return null;
  }
}

function saveSender(s: SenderSettings): void {
  try {
    localStorage.setItem(SENDER_KEY, JSON.stringify(s));
  } catch {
    // Geen opslag (privévenster, geblokkeerd): dan per sessie invullen, zoals vroeger.
  }
}

// Returns how many entries had their photos dropped (0 = all saved, -1 = complete failure)
export function saveDraft(state: PersistedState): number {
  const tryWrite = (s: PersistedState) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  };

  const isQuotaError = (e: unknown) =>
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

  try {
    tryWrite(state);
    return 0;
  } catch (e) {
    if (!isQuotaError(e)) return -1;
  }

  // Strip photos from entries back-to-front until it fits
  const entries = state.entries.map(entry => ({ ...entry }));
  let dropped = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].photos.length === 0) continue;
    entries[i] = { ...entries[i], photos: [] };
    dropped++;
    try {
      tryWrite({ ...state, entries });
      return dropped;
    } catch (e) {
      if (!isQuotaError(e)) return -1;
    }
  }
  return -1;
}

export interface Store {
  entries: PostEntry[];
  addEntry: () => void;
  removeEntry: (id: string) => void;
  updateEntry: (id: string, patch: Partial<PostEntry>) => void;
  senderName: string;
  setSenderName: (v: string) => void;
  senderPhone: string;
  setSenderPhone: (v: string) => void;
  senderEmail: string;
  setSenderEmail: (v: string) => void;
  senderCcEmail: string;
  setSenderCcEmail: (v: string) => void;
  reset: () => void;
}

export function useStore(): Store {
  const draft = loadDraft();
  // Onthouden afzender gaat voor; het concept dekt sessies van vóór deze opslag.
  const sender = loadSender() ?? draft;
  const [entries, setEntries] = useState<PostEntry[]>(draft?.entries ?? [newEntry()]);
  const [senderName, setSenderName] = useState(sender?.senderName ?? "");
  const [senderPhone, setSenderPhone] = useState(sender?.senderPhone ?? "");
  const [senderEmail, setSenderEmail] = useState(sender?.senderEmail ?? "");
  const [senderCcEmail, setSenderCcEmail] = useState(sender?.senderCcEmail ?? "");
  useEffect(() => {
    saveDraft({ entries, senderName, senderPhone, senderEmail, senderCcEmail });
  }, [entries, senderName, senderPhone, senderEmail, senderCcEmail]);
  useEffect(() => {
    saveSender({ senderName, senderPhone, senderEmail, senderCcEmail });
  }, [senderName, senderPhone, senderEmail, senderCcEmail]);

  const addEntry = useCallback(
    () => setEntries((prev) => [...prev, newEntry()]),
    [],
  );
  const removeEntry = useCallback(
    (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)),
    [],
  );
  const updateEntry = useCallback(
    (id: string, patch: Partial<PostEntry>) =>
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      ),
    [],
  );

  // Wist alleen de zendingen; de afzender blijft staan voor de volgende aanmelding.
  const reset = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setEntries([newEntry()]);
  }, []);

  return {
    entries,
    addEntry,
    removeEntry,
    updateEntry,
    senderName,
    setSenderName,
    senderPhone,
    setSenderPhone,
    senderEmail,
    setSenderEmail,
    senderCcEmail,
    setSenderCcEmail,
    reset,
  };
}
