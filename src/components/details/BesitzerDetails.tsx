import type { Besitzer, Hunde, Aufenthalte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface BesitzerDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Besitzer;
  /** 1:N „Hunde": VOLLE Liste — der Block filtert auf diesen Record. */
  hundeList: Hunde[];
  /** Zeilen-Klick → overlay.push auf das Hunde-Detail (nie der Edit-Dialog). */
  onOpenHunde: (record: Hunde) => void;
  /** Kontextuelles „+": öffnet den Hunde-Dialog mit diesem Record vorgesetzt. */
  onAddHunde: () => void;
  /** 1:N „Aufenthalte": VOLLE Liste — der Block filtert auf diesen Record. */
  aufenthalteList: Aufenthalte[];
  /** Zeilen-Klick → overlay.push auf das Aufenthalte-Detail (nie der Edit-Dialog). */
  onOpenAufenthalte: (record: Aufenthalte) => void;
  /** Kontextuelles „+": öffnet den Aufenthalte-Dialog mit diesem Record vorgesetzt. */
  onAddAufenthalte: () => void;
}

export function BesitzerDetails({
  record,
  hundeList,
  onOpenHunde,
  onAddHunde,
  aufenthalteList,
  onOpenAufenthalte,
  onAddAufenthalte,
}: BesitzerDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('besitzer', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('besitzer', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('besitzer', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('besitzer', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('besitzer', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('besitzer', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('besitzer', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('besitzer', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('besitzer', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('hunde')}
        items={hundeList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: r.fields.name ?? appLabel('hunde'), meta: r.fields.geburtsdatum })}
        onOpen={onOpenHunde}
        onAdd={onAddHunde}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('aufenthalte')}
        items={aufenthalteList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: appLabel('aufenthalte'), meta: r.fields.anreisedatum })}
        onOpen={onOpenAufenthalte}
        onAdd={onAddAufenthalte}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.BESITZER} recordId={record.record_id} />
    </>
  );
}
