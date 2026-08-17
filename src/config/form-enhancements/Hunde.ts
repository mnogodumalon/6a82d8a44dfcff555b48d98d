import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    'rasse',
    'geschlecht',
    'geburtsdatum',
    'gewicht_kg',
    'impfstatus',
    'fuetterungshinweise',
    'medikamente_besonderheiten',
    'besitzer',
  ],
  defaults: {
    impfstatus: { kind: 'lookup', key: 'unbekannt', label: 'Unbekannt' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
