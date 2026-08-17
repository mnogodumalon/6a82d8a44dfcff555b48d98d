import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Aufenthalte, Hunde, Besitzer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { AufenthalteDialog } from '@/components/dialogs/AufenthalteDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Aufenthalte';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function AufenthalteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Aufenthalte | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hundeList, setHundeList] = useState<Hunde[]>([]);
  const [besitzerList, setBesitzerList] = useState<Besitzer[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, hundeData, besitzerData] = await Promise.all([
        LivingAppsService.getAufenthalte(),
        LivingAppsService.getHunde(),
        LivingAppsService.getBesitzer(),
      ]);
      setHundeList(hundeData);
      setBesitzerList(besitzerData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Aufenthalte['fields']) {
    if (!record) return;
    await LivingAppsService.updateAufenthalteEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteAufenthalteEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/aufenthalte');
  }

  function getHundeDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return hundeList.find(r => r.record_id === refId)?.fields.name ?? '—';
  }

  function getBesitzerDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return besitzerList.find(r => r.record_id === refId)?.fields.vorname ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/aufenthalte')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/aufenthalte')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={appLabel('aufenthalte')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          hund: hundeList,
          besitzer: besitzerList,
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
        <RecordField label={fieldLabel('aufenthalte', 'hund')} value={getHundeDisplayName(record.fields.hund)} format="text" />
        <RecordField label={fieldLabel('aufenthalte', 'besitzer')} value={getBesitzerDisplayName(record.fields.besitzer)} format="text" />
        <RecordField label={fieldLabel('aufenthalte', 'platznummer')} value={record.fields.platznummer} format="pill" />
        <RecordField label={fieldLabel('aufenthalte', 'anreisedatum')} value={record.fields.anreisedatum} format="date" />
        <RecordField label={fieldLabel('aufenthalte', 'abreisedatum')} value={record.fields.abreisedatum} format="date" />
        <RecordField label={fieldLabel('aufenthalte', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('aufenthalte', 'herkunft')} value={record.fields.herkunft} format="pill" />
        <RecordField label={fieldLabel('aufenthalte', 'preis_euro')} value={record.fields.preis_euro} format="text" />
        <RecordField label={fieldLabel('aufenthalte', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AUFENTHALTE} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <AufenthalteDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        hundeList={hundeList}
        besitzerList={besitzerList}
        enablePhotoScan={AI_PHOTO_SCAN['Aufenthalte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Aufenthalte']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('aufenthalte') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
