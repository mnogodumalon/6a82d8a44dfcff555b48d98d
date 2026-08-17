import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Besitzer {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    telefon?: string;
    email?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    notizen?: string;
  };
}

export interface Hunde {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: string;
    rasse?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    geschlecht?: LookupValue;
    gewicht_kg?: number;
    impfstatus?: LookupValue;
    fuetterungshinweise?: string;
    medikamente_besonderheiten?: string;
    foto?: string;
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
  };
}

export interface Aufenthalte {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    hund?: string; // applookup -> URL zu 'Hunde' Record
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
    platznummer?: LookupValue;
    anreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    abreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    herkunft?: LookupValue;
    preis_euro?: number;
    notizen?: string;
  };
}

export interface Buchungsanfragen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    interessent_vorname?: string;
    interessent_nachname?: string;
    interessent_telefon?: string;
    interessent_email?: string;
    hund_name?: string;
    hund_rasse?: string;
    wunsch_anreise?: string; // Format: YYYY-MM-DD oder ISO String
    wunsch_abreise?: string; // Format: YYYY-MM-DD oder ISO String
    nachricht?: string;
    status?: LookupValue;
    eingangsdatum?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export const APP_IDS = {
  BESITZER: '6a82d882c453d4a0583e98c8',
  HUNDE: '6a82d88819637c450f81200c',
  AUFENTHALTE: '6a82d8894fd897dc5239584e',
  BUCHUNGSANFRAGEN: '6a82d88ae45231633776c8cb',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'hunde': {
    geschlecht: [{ key: "maennlich", get label() { return lookupLabel('hunde', 'geschlecht', "maennlich") ?? "Männlich"; } }, { key: "weiblich", get label() { return lookupLabel('hunde', 'geschlecht', "weiblich") ?? "Weiblich"; } }],
    impfstatus: [{ key: "vollstaendig", get label() { return lookupLabel('hunde', 'impfstatus', "vollstaendig") ?? "Vollständig geimpft"; } }, { key: "teilweise", get label() { return lookupLabel('hunde', 'impfstatus', "teilweise") ?? "Teilweise geimpft"; } }, { key: "nicht_geimpft", get label() { return lookupLabel('hunde', 'impfstatus', "nicht_geimpft") ?? "Nicht geimpft"; } }, { key: "unbekannt", get label() { return lookupLabel('hunde', 'impfstatus', "unbekannt") ?? "Unbekannt"; } }],
  },
  'aufenthalte': {
    platznummer: [{ key: "platz_1", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_1") ?? "Platz 1"; } }, { key: "platz_2", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_2") ?? "Platz 2"; } }, { key: "platz_3", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_3") ?? "Platz 3"; } }, { key: "platz_4", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_4") ?? "Platz 4"; } }, { key: "platz_5", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_5") ?? "Platz 5"; } }, { key: "platz_6", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_6") ?? "Platz 6"; } }, { key: "platz_7", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_7") ?? "Platz 7"; } }, { key: "platz_8", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_8") ?? "Platz 8"; } }, { key: "platz_9", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_9") ?? "Platz 9"; } }, { key: "platz_10", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_10") ?? "Platz 10"; } }, { key: "platz_11", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_11") ?? "Platz 11"; } }, { key: "platz_12", get label() { return lookupLabel('aufenthalte', 'platznummer', "platz_12") ?? "Platz 12"; } }],
    status: [{ key: "geplant", get label() { return lookupLabel('aufenthalte', 'status', "geplant") ?? "Geplant"; } }, { key: "anwesend", get label() { return lookupLabel('aufenthalte', 'status', "anwesend") ?? "Anwesend"; } }, { key: "abgereist", get label() { return lookupLabel('aufenthalte', 'status', "abgereist") ?? "Abgereist"; } }, { key: "storniert", get label() { return lookupLabel('aufenthalte', 'status', "storniert") ?? "Storniert"; } }],
    herkunft: [{ key: "direkt", get label() { return lookupLabel('aufenthalte', 'herkunft', "direkt") ?? "Direkte Buchung"; } }, { key: "aus_anfrage", get label() { return lookupLabel('aufenthalte', 'herkunft', "aus_anfrage") ?? "Aus Buchungsanfrage"; } }],
  },
  'buchungsanfragen': {
    status: [{ key: "offen", get label() { return lookupLabel('buchungsanfragen', 'status', "offen") ?? "Offen"; } }, { key: "bestaetigt", get label() { return lookupLabel('buchungsanfragen', 'status', "bestaetigt") ?? "Bestätigt"; } }, { key: "abgelehnt", get label() { return lookupLabel('buchungsanfragen', 'status', "abgelehnt") ?? "Abgelehnt"; } }, { key: "abgelaufen", get label() { return lookupLabel('buchungsanfragen', 'status', "abgelaufen") ?? "Abgelaufen"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'besitzer': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'notizen': 'string/textarea',
  },
  'hunde': {
    'name': 'string/text',
    'rasse': 'string/text',
    'geburtsdatum': 'date/date',
    'geschlecht': 'lookup/radio',
    'gewicht_kg': 'number',
    'impfstatus': 'lookup/select',
    'fuetterungshinweise': 'string/textarea',
    'medikamente_besonderheiten': 'string/textarea',
    'foto': 'file',
    'besitzer': 'applookup/select',
  },
  'aufenthalte': {
    'hund': 'applookup/select',
    'besitzer': 'applookup/select',
    'platznummer': 'lookup/select',
    'anreisedatum': 'date/date',
    'abreisedatum': 'date/date',
    'status': 'lookup/select',
    'herkunft': 'lookup/radio',
    'preis_euro': 'number',
    'notizen': 'string/textarea',
  },
  'buchungsanfragen': {
    'interessent_vorname': 'string/text',
    'interessent_nachname': 'string/text',
    'interessent_telefon': 'string/tel',
    'interessent_email': 'string/email',
    'hund_name': 'string/text',
    'hund_rasse': 'string/text',
    'wunsch_anreise': 'date/date',
    'wunsch_abreise': 'date/date',
    'nachricht': 'string/textarea',
    'status': 'lookup/select',
    'eingangsdatum': 'date/date',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateBesitzer = StripLookup<Besitzer['fields']>;
export type CreateHunde = StripLookup<Hunde['fields']>;
export type CreateAufenthalte = StripLookup<Aufenthalte['fields']>;
export type CreateBuchungsanfragen = StripLookup<Buchungsanfragen['fields']>;