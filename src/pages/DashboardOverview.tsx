import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays, isToday, isBefore, isAfter, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import { tx, dateFnsLocale, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';
import { lookupOption } from '@/types/app';
import { lookupKey } from '@/lib/formatters';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import {
  IconDog,
  IconCalendar,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconPlus,
} from '@tabler/icons-react';

// PLATZ_GROUPS is built inside the component body (see useMemo below)
// so locale-aware labels are read at render time, not module scope.

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    aufenthalte, setAufenthalte, buchungsanfragen, setBuchungsanfragen,
    hundeMap, besitzerMap,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const s = lookupKey(top.record.fields.status);
        if (s === 'offen') {
          return {
            label: tx('Bestätigen & Aufenthalt anlegen'),
            onClick: () => confirmAnfrage(top.record),
          };
        }
      }
      if (top.type === 'aufenthalte') {
        const s = lookupKey(top.record.fields.status);
        if (s === 'geplant') return { label: tx('Check-in'), onClick: () => checkIn(top.record) };
        if (s === 'anwesend') return { label: tx('Check-out'), onClick: () => checkOut(top.record) };
      }
      return undefined;
    },
  });

  const enrichedAufenthalte = crud.enriched.aufenthalte;

  const [anfragenFilter, setAnfragenFilter] = useState<'offen' | null>(null);

  // ── Derived values ──────────────────────────────────────────────────────────

  const today = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);

  // Build resource groups inside component body so locale-aware labels are read at render time
  const platzGroups = useMemo<ResourceGroup[]>(
    () => LOOKUP_OPTIONS['aufenthalte']['platznummer'].map(o => ({ key: o.key, label: o.label })),
    [],
  );

  const aktiveAufenthalte = useMemo(
    () => enrichedAufenthalte.filter(a => {
      const s = lookupKey(a.fields.status);
      return s === 'anwesend' || s === 'geplant';
    }),
    [enrichedAufenthalte],
  );

  const heuteAnreisend = useMemo(
    () => enrichedAufenthalte.filter(a => a.fields.anreisedatum === today && lookupKey(a.fields.status) === 'geplant'),
    [enrichedAufenthalte, today],
  );

  const heuteAbreisend = useMemo(
    () => enrichedAufenthalte.filter(a => a.fields.abreisedatum === today && lookupKey(a.fields.status) === 'anwesend'),
    [enrichedAufenthalte, today],
  );

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.status) === 'offen'),
    [buchungsanfragen],
  );

  // Anfragen die >13 Tage ohne Reaktion sind (werden bald automatisch abgelaufen)
  const ablaufendeAnfragen = useMemo(() => {
    const cutoff = new Date(clock);
    cutoff.setDate(cutoff.getDate() - 13);
    return offeneAnfragen.filter(a => {
      if (!a.fields.eingangsdatum) return false;
      return isBefore(parseISO(a.fields.eingangsdatum), cutoff);
    });
  }, [offeneAnfragen, clock]);

  // Belegte Plätze heute
  const belegtHeute = useMemo(() => {
    const s = new Set<string>();
    enrichedAufenthalte.forEach(a => {
      if (
        a.fields.anreisedatum && a.fields.abreisedatum &&
        a.fields.anreisedatum <= today && a.fields.abreisedatum >= today &&
        lookupKey(a.fields.status) !== 'storniert' && lookupKey(a.fields.status) !== 'abgereist'
      ) {
        const key = lookupKey(a.fields.platznummer);
        if (key) s.add(key);
      }
    });
    return s.size;
  }, [enrichedAufenthalte, today]);

  // ResourceTimeline events
  const timelineEvents = useMemo<ResourceEvent[]>(
    () =>
      enrichedAufenthalte
        .filter(a => {
          const s = lookupKey(a.fields.status);
          return s !== 'storniert' && a.fields.anreisedatum && a.fields.platznummer;
        })
        .map(a => {
          const s = lookupKey(a.fields.status);
          const tone =
            s === 'anwesend' ? 'success' :
            s === 'geplant' ? 'primary' :
            s === 'abgereist' ? 'default' : 'default';
          return {
            id: `aufenthalt:${a.record_id}`,
            start: a.fields.anreisedatum!,
            end: a.fields.abreisedatum,
            allDay: true,
            title: a.hundName || a.besitzerName || tx('Unbekannt'),
            subtitle: a.besitzerName,
            tone,
            group: lookupKey(a.fields.platznummer) ?? '',
          };
        }),
    [enrichedAufenthalte],
  );

  // ── Write helpers ───────────────────────────────────────────────────────────

  const checkIn = useCallback((aufenthalt: typeof enrichedAufenthalte[0]) => {
    const prev = lookupKey(aufenthalt.fields.status);
    const newStatus = lookupOption('aufenthalte', 'status', 'anwesend');
    setAufenthalte(prev_ => prev_.map(a =>
      a.record_id === aufenthalt.record_id
        ? { ...a, fields: { ...a.fields, status: newStatus } }
        : a,
    ));
    void LivingAppsService.updateAufenthalteEntry(aufenthalt.record_id, { status: 'anwesend' }).catch(() => fetchAll());
    undoToast(tx`${aufenthalt.hundName} — eingecheckt`, () => {
      setAufenthalte(prev_ => prev_.map(a =>
        a.record_id === aufenthalt.record_id
          ? { ...a, fields: { ...a.fields, status: lookupOption('aufenthalte', 'status', prev ?? 'geplant') } }
          : a,
      ));
      void LivingAppsService.updateAufenthalteEntry(aufenthalt.record_id, { status: prev ?? 'geplant' }).catch(() => fetchAll());
    });
  }, [setAufenthalte, fetchAll]);

  const checkOut = useCallback((aufenthalt: typeof enrichedAufenthalte[0]) => {
    const prev = lookupKey(aufenthalt.fields.status);
    const newStatus = lookupOption('aufenthalte', 'status', 'abgereist');
    setAufenthalte(prev_ => prev_.map(a =>
      a.record_id === aufenthalt.record_id
        ? { ...a, fields: { ...a.fields, status: newStatus } }
        : a,
    ));
    void LivingAppsService.updateAufenthalteEntry(aufenthalt.record_id, { status: 'abgereist' }).catch(() => fetchAll());
    undoToast(tx`${aufenthalt.hundName} — ausgecheckt`, () => {
      setAufenthalte(prev_ => prev_.map(a =>
        a.record_id === aufenthalt.record_id
          ? { ...a, fields: { ...a.fields, status: lookupOption('aufenthalte', 'status', prev ?? 'anwesend') } }
          : a,
      ));
      void LivingAppsService.updateAufenthalteEntry(aufenthalt.record_id, { status: prev ?? 'anwesend' }).catch(() => fetchAll());
    });
  }, [setAufenthalte, fetchAll]);

  const confirmAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[0]) => {
    // Mark anfrage as bestätigt
    const prevStatus = lookupKey(anfrage.fields.status);
    const newStatus = lookupOption('buchungsanfragen', 'status', 'bestaetigt');
    setBuchungsanfragen(prev => prev.map(a =>
      a.record_id === anfrage.record_id
        ? { ...a, fields: { ...a.fields, status: newStatus } }
        : a,
    ));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { status: 'bestaetigt' });
      // Create new Aufenthalt from the confirmed Anfrage
      crud.aufenthalte.openCreate({
        anreisedatum: anfrage.fields.wunsch_anreise,
        abreisedatum: anfrage.fields.wunsch_abreise,
        herkunft: 'aus_anfrage',
        status: 'geplant',
      });
      undoToast(tx`Anfrage von ${anfrage.fields.interessent_vorname ?? ''} ${anfrage.fields.interessent_nachname ?? ''} — bestätigt`);
    } catch {
      setBuchungsanfragen(prev => prev.map(a =>
        a.record_id === anfrage.record_id
          ? { ...a, fields: { ...a.fields, status: lookupOption('buchungsanfragen', 'status', prevStatus ?? 'offen') } }
          : a,
      ));
      fetchAll();
    }
  }, [setBuchungsanfragen, crud.aufenthalte, fetchAll]);

  const rejectAnfrage = useCallback((anfrage: typeof buchungsanfragen[0]) => {
    const prevStatus = lookupKey(anfrage.fields.status);
    const newStatus = lookupOption('buchungsanfragen', 'status', 'abgelehnt');
    setBuchungsanfragen(prev => prev.map(a =>
      a.record_id === anfrage.record_id
        ? { ...a, fields: { ...a.fields, status: newStatus } }
        : a,
    ));
    void LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { status: 'abgelehnt' }).catch(() => fetchAll());
    undoToast(tx`Anfrage von ${anfrage.fields.interessent_vorname ?? ''} — abgelehnt`, () => {
      setBuchungsanfragen(prev => prev.map(a =>
        a.record_id === anfrage.record_id
          ? { ...a, fields: { ...a.fields, status: lookupOption('buchungsanfragen', 'status', prevStatus ?? 'offen') } }
          : a,
      ));
      void LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { status: prevStatus ?? 'offen' }).catch(() => fetchAll());
    });
  }, [setBuchungsanfragen, fetchAll]);

  // Drag-to-move on timeline (cross-spot move)
  const handleEventDrop = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string,
  ): Promise<void | string> => {
    const aufenthaltId = id.split(':')[1] ?? '';
    const aufenthalt = aufenthalte.find(a => a.record_id === aufenthaltId);
    if (!aufenthalt) return;

    // No-double-booking check
    if (newGroup) {
      const conflict = aufenthalte.find(a =>
        a.record_id !== aufenthaltId &&
        lookupKey(a.fields.platznummer) === newGroup &&
        lookupKey(a.fields.status) !== 'storniert' &&
        a.fields.anreisedatum && a.fields.abreisedatum &&
        !(a.fields.abreisedatum < newStart || (newEnd && a.fields.anreisedatum > newEnd))
      );
      if (conflict) return tx('Platz bereits belegt in diesem Zeitraum');
    }

    const platznummerPatch = newGroup ? { platznummer: newGroup } : {};
    const prevAnreise = aufenthalt.fields.anreisedatum;
    const prevAbreise = aufenthalt.fields.abreisedatum;
    const prevPlatz = lookupKey(aufenthalt.fields.platznummer);

    setAufenthalte(prev => prev.map(a =>
      a.record_id === aufenthaltId
        ? {
            ...a,
            fields: {
              ...a.fields,
              anreisedatum: newStart,
              ...(newEnd ? { abreisedatum: newEnd } : {}),
              ...(newGroup ? { platznummer: lookupOption('aufenthalte', 'platznummer', newGroup) } : {}),
            },
          }
        : a,
    ));

    try {
      await LivingAppsService.updateAufenthalteEntry(aufenthaltId, {
        anreisedatum: newStart,
        ...(newEnd ? { abreisedatum: newEnd } : {}),
        ...platznummerPatch,
      });
      undoToast(tx('Aufenthalt verschoben'), () => {
        setAufenthalte(prev => prev.map(a =>
          a.record_id === aufenthaltId
            ? {
                ...a,
                fields: {
                  ...a.fields,
                  anreisedatum: prevAnreise,
                  abreisedatum: prevAbreise,
                  ...(prevPlatz ? { platznummer: lookupOption('aufenthalte', 'platznummer', prevPlatz) } : {}),
                },
              }
            : a,
        ));
        void LivingAppsService.updateAufenthalteEntry(aufenthaltId, {
          anreisedatum: prevAnreise,
          abreisedatum: prevAbreise,
          ...(prevPlatz ? { platznummer: prevPlatz } : {}),
        }).catch(() => fetchAll());
      });
    } catch {
      fetchAll();
    }
  }, [aufenthalte, setAufenthalte, fetchAll]);

  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string): Promise<void | string> => {
    const aufenthaltId = id.split(':')[1] ?? '';
    const aufenthalt = aufenthalte.find(a => a.record_id === aufenthaltId);
    if (!aufenthalt) return;

    const prevAnreise = aufenthalt.fields.anreisedatum;
    const prevAbreise = aufenthalt.fields.abreisedatum;

    setAufenthalte(prev => prev.map(a =>
      a.record_id === aufenthaltId
        ? { ...a, fields: { ...a.fields, anreisedatum: newStart, abreisedatum: newEnd } }
        : a,
    ));

    try {
      await LivingAppsService.updateAufenthalteEntry(aufenthaltId, { anreisedatum: newStart, abreisedatum: newEnd });
      undoToast(tx('Aufenthaltsdauer geändert'), () => {
        setAufenthalte(prev => prev.map(a =>
          a.record_id === aufenthaltId
            ? { ...a, fields: { ...a.fields, anreisedatum: prevAnreise, abreisedatum: prevAbreise } }
            : a,
        ));
        void LivingAppsService.updateAufenthalteEntry(aufenthaltId, { anreisedatum: prevAnreise, abreisedatum: prevAbreise }).catch(() => fetchAll());
      });
    } catch {
      fetchAll();
    }
  }, [aufenthalte, setAufenthalte, fetchAll]);

  // ── Hooks guard ─────────────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── Context line ─────────────────────────────────────────────────────────────
  const anreiseNamen = namen(heuteAnreisend.map(a => a.hundName));
  const abreiseNamen = namen(heuteAbreisend.map(a => a.hundName));
  const contextLine = heuteAnreisend.length === 0 && heuteAbreisend.length === 0
    ? aktiveAufenthalte.length > 0
      ? tx`${aktiveAufenthalte.length} Hunde zu Gast — heute keine Bewegungen.`
      : tx('Heute keine Gäste — ein ruhiger Tag.')
    : heuteAnreisend.length > 0 && heuteAbreisend.length > 0
      ? tx`${anreiseNamen} reisen an, ${abreiseNamen} reisen ab.`
      : heuteAnreisend.length > 0
        ? tx`${anreiseNamen} ${heuteAnreisend.length === 1 ? tx('reist heute an') : tx('reisen heute an')}.`
        : tx`${abreiseNamen} ${heuteAbreisend.length === 1 ? tx('reist heute ab') : tx('reisen heute ab')}.`;

  const freie = 12 - belegtHeute;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.aufenthalte.openCreate({ status: 'geplant', herkunft: 'direkt', anreisedatum: today })}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          ablaufendeAnfragen.length > 0
            ? (
              <HeroBanner
                icon={<IconAlertTriangle size={18} />}
                action={{
                  label: tx('Jetzt bestätigen'),
                  onClick: () => crud.buchungsanfragen.openDetail(ablaufendeAnfragen[0]),
                }}
              >
                <b>{namen(ablaufendeAnfragen.map(a => `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim()))}</b>
                {' '}
                {ablaufendeAnfragen.length === 1
                  ? tx('— Buchungsanfrage läuft bald ab. Jetzt reagieren!')
                  : tx('— Buchungsanfragen laufen bald ab. Jetzt reagieren!')}
              </HeroBanner>
            )
            : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt')}
              value={`${belegtHeute}/12`}
              icon={<IconDog size={16} />}
              tone={belegtHeute >= 10 ? 'warning' : belegtHeute > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Frei heute')}
              value={freie}
              tone={freie === 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Anreise')}
              value={heuteAnreisend.length}
              icon={<IconCalendar size={16} />}
              tone={heuteAnreisend.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Abreise')}
              value={heuteAbreisend.length}
              tone={heuteAbreisend.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              tone={offeneAnfragen.length > 0 ? 'primary' : 'default'}
              onClick={() => setAnfragenFilter(f => f === 'offen' ? null : 'offen')}
              active={anfragenFilter === 'offen'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={timelineEvents}
            groups={platzGroups}
            axis="day"
            defaultRange="week"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const aufenthaltId = ev.id.split(':')[1] ?? '';
              const rec = aufenthalte.find(a => a.record_id === aufenthaltId);
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
            cellClassName={(date, _group) => {
              const d = format(date, 'yyyy-MM-dd');
              if (d === today) return 'bg-primary/5';
              return '';
            }}
          />
        }
        aside={
          <>
            {/* Heute: Anreise & Abreise */}
            <WorkList
              title={tx('Heute')}
              items={[
                ...heuteAnreisend.map(a => ({
                  id: `in:${a.record_id}`,
                  title: a.hundName || a.besitzerName || tx('Unbekannter Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-emerald-600">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {appLabel('besitzer')}: {a.besitzerName || '—'}</span>
                      {a.fields.platznummer && (
                        <span className="text-muted-foreground"> · {a.fields.platznummer.label}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Check-in'),
                    onClick: () => checkIn(a),
                  },
                })),
                ...heuteAbreisend.map(a => ({
                  id: `out:${a.record_id}`,
                  title: a.hundName || a.besitzerName || tx('Unbekannter Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {a.besitzerName || '—'}</span>
                      {a.fields.platznummer && (
                        <span className="text-muted-foreground"> · {a.fields.platznummer.label}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Check-out'),
                    onClick: () => checkOut(a),
                  },
                })),
              ]}
              onItemClick={id => {
                const aufenthaltId = id.replace(/^(in|out):/, '');
                const rec = aufenthalte.find(a => a.record_id === aufenthaltId);
                if (rec) crud.aufenthalte.openDetail(rec);
              }}
              empty={{
                text: tx('Heute keine An- oder Abreisen'),
                action: {
                  label: tx('Neue Buchung'),
                  onClick: () => crud.aufenthalte.openCreate({ status: 'geplant', herkunft: 'direkt', anreisedatum: today }),
                },
              }}
            />

            {/* Buchungsanfragen */}
            <WorkList
              title={tx('Buchungsanfragen')}
              items={(anfragenFilter === 'offen' ? offeneAnfragen : buchungsanfragen.filter(a => lookupKey(a.fields.status) === 'offen' || lookupKey(a.fields.status) === 'abgelaufen')).map(a => {
                const s = lookupKey(a.fields.status);
                const isAblaufend = ablaufendeAnfragen.some(b => b.record_id === a.record_id);
                return {
                  id: a.record_id,
                  title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannt'),
                  secondLine: (
                    <>
                      <span className="font-medium text-foreground">{a.fields.hund_name || '—'}</span>
                      {a.fields.wunsch_anreise && (
                        <span className="text-muted-foreground">
                          {' · '}{formatDate(a.fields.wunsch_anreise)}
                          {a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}
                        </span>
                      )}
                      {isAblaufend && (
                        <span className="font-medium text-destructive"> · {tx('Läuft ab!')}</span>
                      )}
                    </>
                  ),
                  action: s === 'offen'
                    ? { label: tx('Bestätigen'), onClick: () => void confirmAnfrage(a) }
                    : undefined,
                };
              })}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Buchungsanfragen'),
                action: {
                  label: tx('Anfrage erfassen'),
                  onClick: () => crud.buchungsanfragen.openCreate({ status: 'offen', eingangsdatum: today }),
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
