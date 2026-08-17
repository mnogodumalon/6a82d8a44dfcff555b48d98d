import type { EnrichedAufenthalte, EnrichedHunde } from '@/types/enriched';
import type { Aufenthalte, Besitzer, Hunde } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface HundeMaps {
  besitzerMap: Map<string, Besitzer>;
}

export function enrichHunde(
  hunde: Hunde[],
  maps: HundeMaps
): EnrichedHunde[] {
  return hunde.map(r => ({
    ...r,
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
  }));
}

interface AufenthalteMaps {
  hundeMap: Map<string, Hunde>;
  besitzerMap: Map<string, Besitzer>;
}

export function enrichAufenthalte(
  aufenthalte: Aufenthalte[],
  maps: AufenthalteMaps
): EnrichedAufenthalte[] {
  return aufenthalte.map(r => ({
    ...r,
    hundName: resolveDisplay(r.fields.hund, maps.hundeMap, 'name'),
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
  }));
}
