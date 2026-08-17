import type { Aufenthalte, Hunde, Besitzer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface AufenthalteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Aufenthalte;
  /** N:1-Ziel „Hunde": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  hundeList: Hunde[];
  /** Klick auf die Hunde-Relation → overlay.push auf dessen Detail. */
  onOpenHunde?: (record: Hunde) => void;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
}

export function AufenthalteDetails({
  record,
  hundeList,
  onOpenHunde,
  besitzerList,
  onOpenBesitzer,
}: AufenthalteDetailsProps) {
  const hundTarget = hundeList.find(r => r.record_id === extractRecordId(record.fields.hund));
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('aufenthalte', 'platznummer')} value={record.fields.platznummer} format="pill" />
        <RecordField label={fieldLabel('aufenthalte', 'anreisedatum')} value={record.fields.anreisedatum} format="date" />
        <RecordField label={fieldLabel('aufenthalte', 'abreisedatum')} value={record.fields.abreisedatum} format="date" />
        <RecordField label={fieldLabel('aufenthalte', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('aufenthalte', 'herkunft')} value={record.fields.herkunft} format="pill" />
        <RecordField label={fieldLabel('aufenthalte', 'preis_euro')} value={record.fields.preis_euro} format="text" />
        <RecordField label={fieldLabel('aufenthalte', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('aufenthalte', 'hund')}
          name={hundTarget?.fields.name ?? '—'}
          meta={[hundTarget?.fields.rasse].filter(Boolean).join(' · ') || undefined}
          onClick={hundTarget && onOpenHunde ? () => onOpenHunde!(hundTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('aufenthalte', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AUFENTHALTE} recordId={record.record_id} />
    </>
  );
}
