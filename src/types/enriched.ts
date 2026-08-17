import type { Aufenthalte, Hunde } from './app';

export type EnrichedHunde = Hunde & {
  besitzerName: string;
};

export type EnrichedAufenthalte = Aufenthalte & {
  hundName: string;
  besitzerName: string;
};
