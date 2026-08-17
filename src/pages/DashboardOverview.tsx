import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { dateFnsLocale } from '@/i18n';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';
import { lookupOption } from '@/types/app';
import { lookupKey } from '@/lib/formatters';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import {
  ResourceTimeline,
  ResourceTimelineSkeleton,
  ResourceTimelineError,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import {
  IconDog,
  IconCalendar,
  IconArrowRight,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconPlus,
} from '@tabler/icons-react';

const PLATZ_KEYS = [
  'platz_1','platz_2','platz_3','platz_4','platz_5','platz_6',
  'platz_7','platz_8','platz_9','platz_10','platz_11','platz_12',
] as const;

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    aufenthalte, setAufenthalte, buchungsanfragen, setBuchungsanfragen,
    besitzerMap, hundeMap,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const rec = top.record;
        if (lookupKey(rec.fields.status) === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(rec),
          };
        }
      }
      if (top.type === 'aufenthalte') {
        const rec = top.record;
        const status = lookupKey(rec.fields.status);
        if (status === 'geplant') {
          return {
            label: tx('Check-in bestätigen'),
            onClick: () => checkIn(rec),
          };
        }
        if (status === 'anwesend') {
          return {
            label: tx('Check-out'),
            onClick: () => checkOut(rec),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedAufenthalte = crud.enriched.aufenthalte;
  const enrichedHunde = crud.enriched.hunde;

  const [timelineError, setTimelineError] = useState<Error | null>(null);

  const today = format(clock, 'yyyy-MM-dd');

  // Derive today's arrivals and departures
  const todayArrivals = useMemo(
    () => enrichedAufenthalte.filter(a => a.fields.anreisedatum === today && lookupKey(a.fields.status) !== 'storniert'),
    [enrichedAufenthalte, today]
  );
  const todayDepartures = useMemo(
    () => enrichedAufenthalte.filter(a => a.fields.abreisedatum === today && lookupKey(a.fields.status) !== 'storniert'),
    [enrichedAufenthalte, today]
  );
  const currentlyPresent = useMemo(
    () => enrichedAufenthalte.filter(a => lookupKey(a.fields.status) === 'anwesend'),
    [enrichedAufenthalte]
  );
  const openAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.status) === 'offen'),
    [buchungsanfragen]
  );
  const belegtHeute = useMemo(
    () => enrichedAufenthalte.filter(a => {
      const s = lookupKey(a.fields.status);
      if (s === 'storniert' || s === 'abgereist') return false;
      const an = a.fields.anreisedatum;
      const ab = a.fields.abreisedatum;
      if (!an) return false;
      return an <= today && (!ab || ab >= today);
    }),
    [enrichedAufenthalte, today]
  );

  // Advance helpers — shared across banner, list and overlay footer
  const confirmAnfrage = useCallback(async (rec: typeof buchungsanfragen[0]) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(bs => bs.map(b => b.record_id === rec.record_id
      ? { ...b, fields: { ...b.fields, status: lookupOption('buchungsanfragen', 'status', 'bestaetigt') } }
      : b
    ));
    undoToast(
      tx`${rec.fields.interessent_vorname ?? ''} ${rec.fields.interessent_nachname ?? ''} — Anfrage bestätigt`,
      async () => {
        setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { status: 'offen' });
      }
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { status: 'bestaetigt' });
    } catch {
      setBuchungsanfragen(prev);
      fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (rec: typeof buchungsanfragen[0]) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(bs => bs.map(b => b.record_id === rec.record_id
      ? { ...b, fields: { ...b.fields, status: lookupOption('buchungsanfragen', 'status', 'abgelehnt') } }
      : b
    ));
    undoToast(
      tx`${rec.fields.interessent_vorname ?? ''} — Anfrage abgelehnt`,
      async () => {
        setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { status: 'offen' });
      }
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { status: 'abgelehnt' });
    } catch {
      setBuchungsanfragen(prev);
      fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const checkIn = useCallback(async (rec: typeof aufenthalte[0]) => {
    const prev = [...aufenthalte];
    setAufenthalte(as => as.map(a => a.record_id === rec.record_id
      ? { ...a, fields: { ...a.fields, status: lookupOption('aufenthalte', 'status', 'anwesend') } }
      : a
    ));
    const hundName = rec.fields.hund ? (hundeMap.get(extractRecordId(rec.fields.hund) ?? '')?.fields.name ?? '') : '';
    undoToast(
      tx`${hundName} — eingecheckt`,
      async () => {
        setAufenthalte(prev);
        await LivingAppsService.updateAufenthalteEntry(rec.record_id, { status: 'geplant' });
      }
    );
    try {
      await LivingAppsService.updateAufenthalteEntry(rec.record_id, { status: 'anwesend' });
    } catch {
      setAufenthalte(prev);
      fetchAll();
    }
  }, [aufenthalte, setAufenthalte, hundeMap, fetchAll]);

  const checkOut = useCallback(async (rec: typeof aufenthalte[0]) => {
    const prev = [...aufenthalte];
    setAufenthalte(as => as.map(a => a.record_id === rec.record_id
      ? { ...a, fields: { ...a.fields, status: lookupOption('aufenthalte', 'status', 'abgereist') } }
      : a
    ));
    const hundName = rec.fields.hund ? (hundeMap.get(extractRecordId(rec.fields.hund) ?? '')?.fields.name ?? '') : '';
    undoToast(
      tx`${hundName} — ausgecheckt`,
      async () => {
        setAufenthalte(prev);
        await LivingAppsService.updateAufenthalteEntry(rec.record_id, { status: 'anwesend' });
      }
    );
    try {
      await LivingAppsService.updateAufenthalteEntry(rec.record_id, { status: 'abgereist' });
    } catch {
      setAufenthalte(prev);
      fetchAll();
    }
  }, [aufenthalte, setAufenthalte, hundeMap, fetchAll]);

  // ResourceTimeline: groups = 12 Plätze (static lookup)
  const platzOptions = useMemo(
    () => LOOKUP_OPTIONS['aufenthalte']?.platznummer ?? [],
    []
  );

  const groups = useMemo<ResourceGroup[]>(
    () => platzOptions.map(opt => ({ key: opt.key, label: opt.label })),
    [platzOptions]
  );

  // Map Aufenthalte → ResourceEvents
  const events = useMemo<ResourceEvent[]>(
    () => enrichedAufenthalte
      .filter(a => !!a.fields.anreisedatum && !!a.fields.platznummer && lookupKey(a.fields.status) !== 'storniert')
      .map(a => {
        const status = lookupKey(a.fields.status);
        const tone: 'primary' | 'success' | 'warning' | 'default' =
          status === 'anwesend' ? 'success' :
          status === 'geplant' ? 'primary' :
          status === 'abgereist' ? 'default' : 'warning';
        return {
          id: `aufenthalt:${a.record_id}`,
          start: a.fields.anreisedatum!,
          end: a.fields.abreisedatum,
          allDay: true,
          title: a.hundName || tx('Unbekannt'),
          subtitle: a.besitzerName || undefined,
          tone,
          group: lookupKey(a.fields.platznummer) ?? '',
        };
      }),
    [enrichedAufenthalte]
  );

  // Drag: Platz oder Datum verschieben (optimistisch)
  const reschedule = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...aufenthalte];
    setAufenthalte(as => as.map(a => {
      if (a.record_id !== rid) return a;
      const patch: Partial<typeof a.fields> = { anreisedatum: newStart };
      if (newEnd) patch.abreisedatum = newEnd;
      if (newGroup) patch.platznummer = lookupOption('aufenthalte', 'platznummer', newGroup);
      return { ...a, fields: { ...a.fields, ...patch } };
    }));
    const hundName = (() => {
      const a = aufenthalte.find(x => x.record_id === rid);
      if (!a?.fields.hund) return '';
      return hundeMap.get(extractRecordId(a.fields.hund) ?? '')?.fields.name ?? '';
    })();
    undoToast(
      tx`${hundName} — verschoben`,
      async () => {
        setAufenthalte(prev);
        const a = prev.find(x => x.record_id === rid);
        if (a) await LivingAppsService.updateAufenthalteEntry(rid, {
          anreisedatum: a.fields.anreisedatum,
          abreisedatum: a.fields.abreisedatum,
          platznummer: lookupKey(a.fields.platznummer),
        });
      }
    );
    try {
      await LivingAppsService.updateAufenthalteEntry(rid, {
        anreisedatum: newStart,
        ...(newEnd ? { abreisedatum: newEnd } : {}),
        ...(newGroup ? { platznummer: newGroup } : {}),
      });
    } catch {
      setAufenthalte(prev);
      fetchAll();
    }
  }, [aufenthalte, setAufenthalte, hundeMap, fetchAll]);

  const resizeEvent = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...aufenthalte];
    setAufenthalte(as => as.map(a =>
      a.record_id === rid ? { ...a, fields: { ...a.fields, anreisedatum: newStart, abreisedatum: newEnd } } : a
    ));
    try {
      await LivingAppsService.updateAufenthalteEntry(rid, { anreisedatum: newStart, abreisedatum: newEnd });
    } catch {
      setAufenthalte(prev);
      fetchAll();
    }
  }, [aufenthalte, setAufenthalte, fetchAll]);

  // Doppelbuchung verhindern (gleicher Platz, überlappende Daten)
  const checkDoubleBooking = useCallback((newStart: string, newEnd: string | undefined, group: string, excludeId?: string) => {
    const start = parseISO(newStart);
    const end = newEnd ? parseISO(newEnd) : start;
    for (const a of aufenthalte) {
      if (a.record_id === excludeId) continue;
      if (lookupKey(a.fields.platznummer) !== group) continue;
      if (lookupKey(a.fields.status) === 'storniert') continue;
      const as2 = a.fields.anreisedatum ? parseISO(a.fields.anreisedatum) : null;
      const ae = a.fields.abreisedatum ? parseISO(a.fields.abreisedatum) : as2;
      if (!as2) continue;
      if (start <= (ae ?? as2) && end >= as2) return true;
    }
    return false;
  }, [aufenthalte]);

  const onEventDropWithCheck = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string): Promise<string | undefined> => {
    const rid = id.split(':')[1] ?? '';
    const group = newGroup ?? lookupKey(aufenthalte.find(a => a.record_id === rid)?.fields.platznummer) ?? '';
    if (checkDoubleBooking(newStart, newEnd, group, rid)) {
      return tx('Dieser Platz ist in diesem Zeitraum bereits belegt.');
    }
    await reschedule(id, newStart, newEnd, newGroup);
    return undefined;
  }, [aufenthalte, reschedule, checkDoubleBooking]);

  // Context sentence
  const contextLine = useMemo(() => {
    const anreisend = todayArrivals.map(a => a.hundName).filter(Boolean);
    const abreisend = todayDepartures.map(a => a.hundName).filter(Boolean);
    if (anreisend.length === 0 && abreisend.length === 0) {
      if (currentlyPresent.length > 0) {
        return tx`${namen(currentlyPresent.map(a => a.hundName))} ${currentlyPresent.length === 1 ? tx('ist heute zu Gast.') : tx('sind heute zu Gast.')}`;
      }
      return tx('Heute sind keine Ankünfte oder Abreisen geplant.');
    }
    const parts: string[] = [];
    if (anreisend.length > 0) parts.push(`${namen(anreisend)} ${anreisend.length === 1 ? tx('reist an') : tx('reisen an')}`);
    if (abreisend.length > 0) parts.push(`${namen(abreisend)} ${abreisend.length === 1 ? tx('reist ab') : tx('reisen ab')}`);
    return tx`Heute: ${parts.join(' · ')}.`;
  }, [todayArrivals, todayDepartures, currentlyPresent]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const freie = 12 - belegtHeute.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.aufenthalte.openCreate({ anreisedatum: today, status: 'geplant' })}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0 self-start"
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          openAnfragen.length > 0
            ? (
              <HeroBanner
                icon={<IconAlertCircle size={18} />}
                action={{
                  label: tx('Anfrage bestätigen'),
                  onClick: () => confirmAnfrage(openAnfragen[0]),
                }}
              >
                <b>{namen(openAnfragen.map(a => `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim()))}</b>
                {' '}
                {openAnfragen.length === 1
                  ? tx('hat eine unverbindliche Anfrage gestellt — bitte prüfen und bestätigen.')
                  : tx`haben ${openAnfragen.length} offene Anfragen gestellt — bitte prüfen und bestätigen.`
                }
              </HeroBanner>
            )
            : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt heute')}
              value={`${belegtHeute.length} / 12`}
              icon={<IconDog size={16} />}
              tone={belegtHeute.length >= 12 ? 'destructive' : belegtHeute.length >= 10 ? 'warning' : 'primary'}
            />
            <StatStripItem
              title={tx('Frei')}
              value={freie}
              icon={<IconCheck size={16} />}
              tone={freie === 0 ? 'destructive' : freie <= 2 ? 'warning' : 'success'}
            />
            <StatStripItem
              title={tx('Ankünfte heute')}
              value={todayArrivals.length}
              icon={<IconArrowRight size={16} />}
              tone={todayArrivals.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={todayDepartures.length}
              icon={<IconCalendar size={16} />}
              tone={todayDepartures.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={openAnfragen.length}
              icon={<IconAlertCircle size={16} />}
              tone={openAnfragen.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          timelineError
            ? <ResourceTimelineError error={timelineError} onRetry={() => setTimelineError(null)} />
            : (
              <ResourceTimeline
                events={events}
                groups={groups}
                axis="day"
                defaultRange="week"
                defaultDate={clock}
                locale={dateFnsLocale()}
                onEventClick={ev => {
                  const rid = ev.id.split(':')[1] ?? '';
                  const rec = aufenthalte.find(a => a.record_id === rid);
                  if (rec) crud.aufenthalte.openDetail(rec);
                }}
                onEventDrop={onEventDropWithCheck}
                onEventResize={resizeEvent}
                onRangeCreate={(start, end, group) => {
                  crud.aufenthalte.openCreate({
                    anreisedatum: format(start, 'yyyy-MM-dd'),
                    abreisedatum: format(end, 'yyyy-MM-dd'),
                    platznummer: group,
                    status: 'geplant',
                  });
                }}
                onEmptyClick={(date, group) => {
                  crud.aufenthalte.openCreate({
                    anreisedatum: format(date, 'yyyy-MM-dd'),
                    platznummer: group,
                    status: 'geplant',
                  });
                }}
                renderGroupHeader={group => (
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="truncate text-sm font-medium">{group.label}</span>
                    {belegtHeute.some(a => lookupKey(a.fields.platznummer) === group.key) && (
                      <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                )}
              />
            )
        }
        aside={
          <>
            {/* Heute: Ankünfte & Abreisen */}
            <WorkList
              title={tx('Heute')}
              items={[
                ...todayArrivals.map(a => ({
                  id: `arr:${a.record_id}`,
                  title: a.hundName || tx('Unbekannter Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-emerald-600">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {a.besitzerName}</span>
                      {a.fields.platznummer && (
                        <span className="text-muted-foreground"> · {a.fields.platznummer.label}</span>
                      )}
                    </>
                  ),
                  action: lookupKey(a.fields.status) === 'geplant'
                    ? { label: tx('✓ Einchecken'), onClick: () => checkIn(a) }
                    : undefined,
                })),
                ...todayDepartures
                  .filter(a => lookupKey(a.fields.status) === 'anwesend')
                  .map(a => ({
                    id: `dep:${a.record_id}`,
                    title: a.hundName || tx('Unbekannter Hund'),
                    secondLine: (
                      <>
                        <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                        <span className="text-muted-foreground"> · {a.besitzerName}</span>
                        {a.fields.platznummer && (
                          <span className="text-muted-foreground"> · {a.fields.platznummer.label}</span>
                        )}
                      </>
                    ),
                    action: { label: tx('✓ Auschecken'), onClick: () => checkOut(a) },
                  })),
              ]}
              onItemClick={id => {
                const rid = id.replace(/^(arr|dep):/, '');
                const rec = aufenthalte.find(a => a.record_id === rid);
                if (rec) crud.aufenthalte.openDetail(rec);
              }}
              empty={{
                text: currentlyPresent.length > 0
                  ? tx`Keine Bewegungen heute — ${currentlyPresent.length} Gäste logieren.`
                  : tx('Keine Ankünfte oder Abreisen heute.'),
                action: { label: tx('Neue Buchung'), onClick: () => crud.aufenthalte.openCreate({ anreisedatum: today, status: 'geplant' }) },
              }}
              max={8}
            />

            {/* Offene Anfragen */}
            <WorkList
              title={tx('Offene Anfragen')}
              items={openAnfragen.map(a => ({
                id: a.record_id,
                title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannt'),
                secondLine: (
                  <>
                    <span className="font-medium text-foreground">{a.fields.hund_name ?? '—'}</span>
                    {a.fields.wunsch_anreise && (
                      <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}{a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}</span>
                    )}
                  </>
                ),
                action: { label: tx('✓ Bestätigen'), onClick: () => confirmAnfrage(a) },
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles bearbeitet.'),
                action: { label: tx('Anfrage erfassen'), onClick: () => crud.buchungsanfragen.openCreate({ status: 'offen' }) },
              }}
              max={6}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
