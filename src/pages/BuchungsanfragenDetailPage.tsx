import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Buchungsanfragen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { BuchungsanfragenDialog } from '@/components/dialogs/BuchungsanfragenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Buchungsanfragen';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function BuchungsanfragenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Buchungsanfragen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const list = await LivingAppsService.getBuchungsanfragen();
      setRecord(list.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Buchungsanfragen['fields']) {
    if (!record) return;
    await LivingAppsService.updateBuchungsanfragenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteBuchungsanfragenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/buchungsanfragen');
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/buchungsanfragen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/buchungsanfragen')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.interessent_vorname ?? appLabel('buchungsanfragen')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

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

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <BuchungsanfragenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungsanfragen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsanfragen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('buchungsanfragen') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
