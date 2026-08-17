import type { Buchungsanfragen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface BuchungsanfragenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Buchungsanfragen;
}

export function BuchungsanfragenDetails({
  record,
}: BuchungsanfragenDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('buchungsanfragen', 'interessent_vorname')} value={record.fields.interessent_vorname} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'interessent_nachname')} value={record.fields.interessent_nachname} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'interessent_telefon')} value={record.fields.interessent_telefon} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'interessent_email')} value={record.fields.interessent_email} format="email" />
        <RecordField label={fieldLabel('buchungsanfragen', 'hund_name')} value={record.fields.hund_name} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'hund_rasse')} value={record.fields.hund_rasse} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'wunsch_anreise')} value={record.fields.wunsch_anreise} format="date" />
        <RecordField label={fieldLabel('buchungsanfragen', 'wunsch_abreise')} value={record.fields.wunsch_abreise} format="date" />
        <RecordField label={fieldLabel('buchungsanfragen', 'nachricht')} value={record.fields.nachricht} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('buchungsanfragen', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('buchungsanfragen', 'eingangsdatum')} value={record.fields.eingangsdatum} format="date" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BUCHUNGSANFRAGEN} recordId={record.record_id} />
    </>
  );
}
