import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    { row: ['interessent_vorname', 'interessent_nachname'] },
    'interessent_telefon',
    'interessent_email',
    'hund_name',
    'hund_rasse',
    { row: ['wunsch_anreise', 'wunsch_abreise'] },
    'status',
    'eingangsdatum',
    'nachricht',
  ],
  defaults: {
    eingangsdatum: { kind: 'today' },
    status: { kind: 'lookup', key: 'offen', label: 'Offen' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
