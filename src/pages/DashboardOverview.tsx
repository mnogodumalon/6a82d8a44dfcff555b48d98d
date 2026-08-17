import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { dateFnsLocale } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import { tx, appLabel } from '@/i18n';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { EnrichedAufenthalte } from '@/types/enriched';
import {
  IconDog,
  IconCalendarCheck,
  IconAlertTriangle,
  IconPlus,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

function toneForAufenthalt(a: EnrichedAufenthalte): 'primary' | 'success' | 'warning' | 'default' {
  const s = lookupKey(a.fields.status);
  if (s === 'anwesend') return 'success';
  if (s === 'geplant') return 'primary';
  if (s === 'storniert') return 'warning';
  return 'default';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    aufenthalte, setAufenthalte, buchungsanfragen, setBuchungsanfragen,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();
  const [anfragenFilter, setAnfragenFilter] = useState(false);

  // 12 Plätze als Gruppen — muss im Component-Body liegen (Locale-aware Labels)
  const platzGroups = useMemo<ResourceGroup[]>(
    () => (LOOKUP_OPTIONS['aufenthalte']?.['platznummer'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'aufenthalte') {
        const s = lookupKey((top.record as EnrichedAufenthalte).fields.status);
        if (s === 'geplant') return { label: tx('Einchecken'), onClick: () => checkIn(top.record as EnrichedAufenthalte) };
        if (s === 'anwesend') return { label: tx('Auschecken'), onClick: () => checkOut(top.record as EnrichedAufenthalte) };
      }
      if (top.type === 'buchungsanfragen') {
        const s = lookupKey((top.record as any).fields.status);
        if (s === 'offen') return { label: tx('Bestätigen'), onClick: () => confirmAnfrage(top.record as any) };
      }
      return undefined;
    },
  });

  const enrichedAufenthalte = crud.enriched.aufenthalte;

  // ─── alle Hooks OBEN ──────────────────────────────────────────────────────

  const today = format(clock, 'yyyy-MM-dd');

  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedAufenthalte
        .filter(a => !!a.fields.anreisedatum && lookupKey(a.fields.status) !== 'storniert')
        .map(a => ({
          id: `aufenthalt:${a.record_id}`,
          start: a.fields.anreisedatum!,
          end: a.fields.abreisedatum,
          allDay: true,
          title: a.hundName || a.besitzerName || tx('Unbekannt'),
          subtitle: a.besitzerName || undefined,
          tone: toneForAufenthalt(a),
          group: lookupKey(a.fields.platznummer) ?? '',
        })),
    [enrichedAufenthalte],
  );

  const heuteAnreise = useMemo(
    () => enrichedAufenthalte.filter(a => a.fields.anreisedatum === today && lookupKey(a.fields.status) === 'geplant'),
    [enrichedAufenthalte, today],
  );

  const heuteAbreise = useMemo(
    () => enrichedAufenthalte.filter(a => a.fields.abreisedatum === today && lookupKey(a.fields.status) === 'anwesend'),
    [enrichedAufenthalte, today],
  );

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.status) === 'offen'),
    [buchungsanfragen],
  );

  const aktuelBelegte = useMemo(
    () => enrichedAufenthalte.filter(a => lookupKey(a.fields.status) === 'anwesend'),
    [enrichedAufenthalte],
  );

  const freiePlaetze = 12 - aktuelBelegte.length;

  // Advance-Helfer
  const checkIn = useCallback(async (a: EnrichedAufenthalte) => {
    const prev = { ...a, fields: { ...a.fields } };
    setAufenthalte(list =>
      list.map(r => r.record_id === a.record_id
        ? { ...r, fields: { ...r.fields, status: lookupOption('aufenthalte', 'status', 'anwesend') } }
        : r),
    );
    undoToast(tx`${a.hundName || a.besitzerName} — eingecheckt`, async () => {
      setAufenthalte(list => list.map(r => r.record_id === a.record_id ? prev : r));
      await LivingAppsService.updateAufenthalteEntry(a.record_id, { status: 'geplant' }).catch(() => fetchAll());
    });
    await LivingAppsService.updateAufenthalteEntry(a.record_id, { status: 'anwesend' }).catch(() => fetchAll());
  }, [setAufenthalte, fetchAll]);

  const checkOut = useCallback(async (a: EnrichedAufenthalte) => {
    const prev = { ...a, fields: { ...a.fields } };
    setAufenthalte(list =>
      list.map(r => r.record_id === a.record_id
        ? { ...r, fields: { ...r.fields, status: lookupOption('aufenthalte', 'status', 'abgereist') } }
        : r),
    );
    undoToast(tx`${a.hundName || a.besitzerName} — ausgecheckt`, async () => {
      setAufenthalte(list => list.map(r => r.record_id === a.record_id ? prev : r));
      await LivingAppsService.updateAufenthalteEntry(a.record_id, { status: 'anwesend' }).catch(() => fetchAll());
    });
    await LivingAppsService.updateAufenthalteEntry(a.record_id, { status: 'abgereist' }).catch(() => fetchAll());
  }, [setAufenthalte, fetchAll]);

  const confirmAnfrage = useCallback(async (a: (typeof buchungsanfragen)[0]) => {
    const prev = { ...a, fields: { ...a.fields } };
    setBuchungsanfragen(list =>
      list.map(r => r.record_id === a.record_id
        ? { ...r, fields: { ...r.fields, status: lookupOption('buchungsanfragen', 'status', 'bestaetigt') } }
        : r),
    );
    undoToast(
      tx`${(a.fields.interessent_vorname ?? '') + ' ' + (a.fields.interessent_nachname ?? '')} — Anfrage bestätigt`,
      async () => {
        setBuchungsanfragen(list => list.map(r => r.record_id === a.record_id ? prev : r));
        await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { status: 'offen' }).catch(() => fetchAll());
      },
    );
    await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { status: 'bestaetigt' }).catch(() => fetchAll());
  }, [setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (a: (typeof buchungsanfragen)[0]) => {
    const prev = { ...a, fields: { ...a.fields } };
    setBuchungsanfragen(list =>
      list.map(r => r.record_id === a.record_id
        ? { ...r, fields: { ...r.fields, status: lookupOption('buchungsanfragen', 'status', 'abgelehnt') } }
        : r),
    );
    undoToast(
      tx`${(a.fields.interessent_vorname ?? '') + ' ' + (a.fields.interessent_nachname ?? '')} — Anfrage abgelehnt`,
      async () => {
        setBuchungsanfragen(list => list.map(r => r.record_id === a.record_id ? prev : r));
        await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { status: 'offen' }).catch(() => fetchAll());
      },
    );
    await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { status: 'abgelehnt' }).catch(() => fetchAll());
  }, [setBuchungsanfragen, fetchAll]);

  // Drag-Drop Handler für die Timeline
  const handleEventDrop = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string,
  ) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;

    // Platz-Doppelbelegung prüfen
    if (newGroup) {
      const conflict = enrichedAufenthalte.find(a =>
        a.record_id !== rid &&
        lookupKey(a.fields.platznummer) === newGroup &&
        lookupKey(a.fields.status) !== 'storniert' &&
        a.fields.anreisedatum &&
        (newEnd ? a.fields.anreisedatum <= newEnd : true) &&
        (a.fields.abreisedatum ? a.fields.abreisedatum >= newStart : true),
      );
      if (conflict) return tx('Platz bereits belegt in diesem Zeitraum');
    }

    const platzPatch = newGroup ? { platznummer: lookupOption('aufenthalte', 'platznummer', newGroup) } : {};
    setAufenthalte(list =>
      list.map(r =>
        r.record_id === rid
          ? { ...r, fields: { ...r.fields, anreisedatum: newStart, ...(newEnd ? { abreisedatum: newEnd } : {}), ...platzPatch } }
          : r,
      ),
    );
    undoToast(tx('Aufenthalt verschoben'));
    try {
      await LivingAppsService.updateAufenthalteEntry(rid, {
        anreisedatum: newStart,
        ...(newEnd ? { abreisedatum: newEnd } : {}),
        ...(newGroup ? { platznummer: newGroup } : {}),
      });
    } catch {
      fetchAll();
    }
  }, [enrichedAufenthalte, setAufenthalte, fetchAll]);

  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    setAufenthalte(list =>
      list.map(r =>
        r.record_id === rid ? { ...r, fields: { ...r.fields, anreisedatum: newStart, abreisedatum: newEnd } } : r,
      ),
    );
    undoToast(tx('Aufenthalt angepasst'));
    try {
      await LivingAppsService.updateAufenthalteEntry(rid, { anreisedatum: newStart, abreisedatum: newEnd });
    } catch {
      fetchAll();
    }
  }, [setAufenthalte, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Reine Ableitungen ab hier ───────────────────────────────────────────

  const kontextSatz = (): string => {
    const parts: string[] = [];
    if (heuteAnreise.length > 0) {
      const names = namen(heuteAnreise.map(a => a.hundName || a.besitzerName));
      parts.push(tx`${names} reisen heute an`);
    }
    if (heuteAbreise.length > 0) {
      const names = namen(heuteAbreise.map(a => a.hundName || a.besitzerName));
      parts.push(tx`${names} reisen ab`);
    }
    if (parts.length === 0 && aktuelBelegte.length > 0) {
      return tx`${aktuelBelegte.length} Hunde sind aktuell in der Pension.`;
    }
    if (parts.length === 0) {
      return tx('Heute sind keine An- oder Abreisen geplant.');
    }
    return parts.join(' · ');
  };

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{kontextSatz()}</p>
        </div>
        <button
          onClick={() => crud.aufenthalte.openCreate({ status: 'geplant', herkunft: 'direkt' })}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          <span>{tx('Neue Buchung')}</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          offeneAnfragen.length > 0 && (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('Jetzt bestätigen'),
                onClick: () => confirmAnfrage(offeneAnfragen[0]),
              }}
            >
              <b>{namen(offeneAnfragen.map(a => `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim()))}</b>
              {' '}{offeneAnfragen.length === 1 ? tx('hat eine unverbindliche Anfrage gestellt') : tx('haben unverbindliche Anfragen gestellt')}
              {offeneAnfragen[0].fields.wunsch_anreise ? tx` — Wunschanreise ${formatDate(offeneAnfragen[0].fields.wunsch_anreise)}` : ''}.
            </HeroBanner>
          )
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Frei')}
              value={freiePlaetze}
              icon={<IconDog size={16} />}
              tone={freiePlaetze === 0 ? 'warning' : freiePlaetze <= 3 ? 'primary' : 'success'}
            />
            <StatStripItem
              title={tx('Belegt')}
              value={aktuelBelegte.length}
              tone="default"
            />
            <StatStripItem
              title={tx('Heute an')}
              value={heuteAnreise.length}
              tone={heuteAnreise.length > 0 ? 'primary' : 'default'}
              onClick={() => {}}
            />
            <StatStripItem
              title={tx('Heute ab')}
              value={heuteAbreise.length}
              tone={heuteAbreise.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anfragen')}
              value={offeneAnfragen.length}
              icon={offeneAnfragen.length > 0 ? <IconAlertTriangle size={16} /> : undefined}
              tone={offeneAnfragen.length > 0 ? 'destructive' : 'default'}
              onClick={() => setAnfragenFilter(f => !f)}
              active={anfragenFilter}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={platzGroups}
            axis="day"
            defaultRange="2weeks"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1] ?? '';
              const rec = enrichedAufenthalte.find(a => a.record_id === rid);
              if (rec) crud.aufenthalte.openDetail(rec);
            }}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onRangeCreate={(start, end, group) => {
              crud.aufenthalte.openCreate({
                anreisedatum: format(start, 'yyyy-MM-dd'),
                abreisedatum: format(end, 'yyyy-MM-dd'),
                platznummer: group,
                status: 'geplant',
                herkunft: 'direkt',
              });
            }}
            onEmptyClick={(date, group) => {
              crud.aufenthalte.openCreate({
                anreisedatum: format(date, 'yyyy-MM-dd'),
                platznummer: group,
                status: 'geplant',
                herkunft: 'direkt',
              });
            }}
            renderGroupHeader={group => (
              <div className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-sm font-medium">{group.label}</span>
                {aktuelBelegte.some(a => lookupKey(a.fields.platznummer) === group.key) && (
                  <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </div>
            )}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute — An & Abreisen')}
              items={[
                ...heuteAnreise.map(a => ({
                  id: `an:${a.record_id}`,
                  title: a.hundName || a.besitzerName || tx('Unbekannt'),
                  secondLine: (
                    <>
                      <span className="font-medium text-primary">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {a.besitzerName}</span>
                    </>
                  ),
                  action: {
                    label: tx('Einchecken'),
                    onClick: () => checkIn(a),
                  },
                })),
                ...heuteAbreise.map(a => ({
                  id: `ab:${a.record_id}`,
                  title: a.hundName || a.besitzerName || tx('Unbekannt'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {a.besitzerName}</span>
                    </>
                  ),
                  action: {
                    label: tx('Auschecken'),
                    onClick: () => checkOut(a),
                  },
                })),
              ]}
              onItemClick={id => {
                const rid = id.replace(/^(an|ab):/, '');
                const rec = enrichedAufenthalte.find(a => a.record_id === rid);
                if (rec) crud.aufenthalte.openDetail(rec);
              }}
              empty={{
                text: tx('Heute keine An- oder Abreisen — ruhiger Tag!'),
                action: {
                  label: tx('Neue Buchung'),
                  onClick: () => crud.aufenthalte.openCreate({ status: 'geplant', herkunft: 'direkt' }),
                },
              }}
            />

            <WorkList
              title={tx('Offene Anfragen')}
              items={offeneAnfragen.map(a => ({
                id: a.record_id,
                title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannt'),
                secondLine: (
                  <>
                    <span className="font-medium text-foreground">{a.fields.hund_name || '—'}</span>
                    {a.fields.wunsch_anreise && (
                      <span className="text-muted-foreground">
                        {' '}· {formatDate(a.fields.wunsch_anreise)}
                        {a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}
                      </span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bestätigen'),
                  onClick: () => confirmAnfrage(a),
                },
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles bearbeitet.'),
                action: {
                  label: tx('Neue Buchung'),
                  onClick: () => crud.aufenthalte.openCreate({ status: 'geplant' }),
                },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
