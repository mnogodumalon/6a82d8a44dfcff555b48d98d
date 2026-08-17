import type { Hunde, Besitzer, Aufenthalte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface HundeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Hunde;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
  /** 1:N „Aufenthalte": VOLLE Liste — der Block filtert auf diesen Record. */
  aufenthalteList: Aufenthalte[];
  /** Zeilen-Klick → overlay.push auf das Aufenthalte-Detail (nie der Edit-Dialog). */
  onOpenAufenthalte: (record: Aufenthalte) => void;
  /** Kontextuelles „+": öffnet den Aufenthalte-Dialog mit diesem Record vorgesetzt. */
  onAddAufenthalte: () => void;
}

export function HundeDetails({
  record,
  besitzerList,
  onOpenBesitzer,
  aufenthalteList,
  onOpenAufenthalte,
  onAddAufenthalte,
}: HundeDetailsProps) {
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('hunde', 'name')} value={record.fields.name} format="text" />
        <RecordField label={fieldLabel('hunde', 'rasse')} value={record.fields.rasse} format="text" />
        <RecordField label={fieldLabel('hunde', 'geburtsdatum')} value={record.fields.geburtsdatum} format="date" />
        <RecordField label={fieldLabel('hunde', 'geschlecht')} value={record.fields.geschlecht} format="pill" />
        <RecordField label={fieldLabel('hunde', 'gewicht_kg')} value={record.fields.gewicht_kg} format="text" />
        <RecordField label={fieldLabel('hunde', 'impfstatus')} value={record.fields.impfstatus} format="pill" />
        <RecordField label={fieldLabel('hunde', 'fuetterungshinweise')} value={record.fields.fuetterungshinweise} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hunde', 'medikamente_besonderheiten')} value={record.fields.medikamente_besonderheiten} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hunde', 'foto')} className="md:col-span-2">
          {record.fields.foto ? (
            <MediaThumbnail src={record.fields.foto as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('hunde', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('aufenthalte')}
        items={aufenthalteList.filter(r => extractRecordId(r.fields.hund) === record.record_id)}
        map={r => ({ name: appLabel('aufenthalte'), meta: r.fields.anreisedatum })}
        onOpen={onOpenAufenthalte}
        onAdd={onAddAufenthalte}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.HUNDE} recordId={record.record_id} />
    </>
  );
}
