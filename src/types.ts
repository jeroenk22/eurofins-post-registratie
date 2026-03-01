export interface Photo {
  id: string;
  name: string;
  data: string;
}

export interface PostEntry {
  id: string;
  shelf: number | null; // per entry
  name: string;
  colli: number;
  spoed: boolean;
  photos: Photo[];
}

export interface SubmitPayload {
  submitted_at: string;
  datetime_nl: string;
  sender_name: string;
  sender_phone: string | null;
  sender_email: string | null;
  total_entries: number;
  entries: SubmitEntry[];
}

export interface SubmitEntry {
  entry_number: number;
  shelf: string; // per entry
  recipient: string;
  colli: number;
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
