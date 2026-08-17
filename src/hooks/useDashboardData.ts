import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Besitzer, Hunde, Aufenthalte, Buchungsanfragen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
export function useDashboardData() {
  const [besitzer, setBesitzer] = useState<Besitzer[]>([]);
  const [hunde, setHunde] = useState<Hunde[]>([]);
  const [aufenthalte, setAufenthalte] = useState<Aufenthalte[]>([]);
  const [buchungsanfragen, setBuchungsanfragen] = useState<Buchungsanfragen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [besitzerData, hundeData, aufenthalteData, buchungsanfragenData] = await Promise.all([
        LivingAppsService.getBesitzer(),
        LivingAppsService.getHunde(),
        LivingAppsService.getAufenthalte(),
        LivingAppsService.getBuchungsanfragen(),
      ]);
      setBesitzer(besitzerData);
      setHunde(hundeData);
      setAufenthalte(aufenthalteData);
      setBuchungsanfragen(buchungsanfragenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [besitzerData, hundeData, aufenthalteData, buchungsanfragenData] = await Promise.all([
          LivingAppsService.getBesitzer(),
          LivingAppsService.getHunde(),
          LivingAppsService.getAufenthalte(),
          LivingAppsService.getBuchungsanfragen(),
        ]);
        setBesitzer(besitzerData);
        setHunde(hundeData);
        setAufenthalte(aufenthalteData);
        setBuchungsanfragen(buchungsanfragenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const besitzerMap = useMemo(() => {
    const m = new Map<string, Besitzer>();
    besitzer.forEach(r => m.set(r.record_id, r));
    return m;
  }, [besitzer]);

  const hundeMap = useMemo(() => {
    const m = new Map<string, Hunde>();
    hunde.forEach(r => m.set(r.record_id, r));
    return m;
  }, [hunde]);

  return { besitzer, setBesitzer, hunde, setHunde, aufenthalte, setAufenthalte, buchungsanfragen, setBuchungsanfragen, loading, error, fetchAll, besitzerMap, hundeMap };
}