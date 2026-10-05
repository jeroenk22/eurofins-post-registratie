import type { Label } from "../netlify/aanmelding-opslag";

export interface Photo {
  id: string;
  name: string;
  data: string;
}

export interface PostEntry {
  id: string;
  shelf: number | 'overig' | null; // per entry
  shelfDescription: string; // beschrijving wanneer shelf === 'overig'
  name: string;
  adres: string;
  postcode: string;
  plaats: string;
  land: string;
  colli: number;
  colliOmschrijvingen: string[];
  recipientType?: 'Monsternemers' | 'AP06' | 'Mestklanten';
  spoed: boolean;
  photos: Photo[];
}

export interface SubmitPayload {
  submitted_at: string;
  datetime_nl: string;
  app_version: string;
  sender_name: string;
  sender_phone: string | null;
  sender_email: string | null;
  cc_email: string | null;
  total_entries: number;
  entries: SubmitEntry[];
  print_url: string;
  /** Link naar de fotopagina van deze aanmelding (alleen de code, geen Drive-map). */
  fotos_url: string;
  /** Alleen naar naar-make (bewaart ze onder submission_id); forward-webhook krijgt ze niet. */
  labels?: Label[];
  /** Willekeurige code per aanmelding; daaronder bewaart forward-webhook de order-ID's. */
  submission_id: string;
  /** Alleen vanaf desktop; `false` = Make slaat de bevestigingsmail over. */
  mail_versturen?: boolean;
}

export interface SubmitEntry {
  entry_number: number;
  shelf: string; // per entry
  recipient: string;
  colli: number;
  colli_omschrijvingen: string[];
  spoed: boolean;
  photo_count: number;
  photos: SubmitPhoto[];
}

export interface SubmitPhoto {
  filename: string;
  base64: string;
  recipient: string;
  spoed: boolean;
}

export type SubmitState = "idle" | "sending" | "success" | "error";
