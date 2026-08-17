import type { Buchungsanfragen } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface BuchungsanfragenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Buchungsanfragen | null;
  onEdit: (record: Buchungsanfragen) => void;
}

export function BuchungsanfragenViewDialog({ open, onClose, record, onEdit }: BuchungsanfragenViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('buchungsanfragen') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'interessent_vorname')}</Label>
            <p className="text-sm">{record.fields.interessent_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'interessent_nachname')}</Label>
            <p className="text-sm">{record.fields.interessent_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'interessent_telefon')}</Label>
            <p className="text-sm">{record.fields.interessent_telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'interessent_email')}</Label>
            <p className="text-sm">{record.fields.interessent_email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'hund_name')}</Label>
            <p className="text-sm">{record.fields.hund_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'hund_rasse')}</Label>
            <p className="text-sm">{record.fields.hund_rasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'wunsch_anreise')}</Label>
            <p className="text-sm">{formatDate(record.fields.wunsch_anreise)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'wunsch_abreise')}</Label>
            <p className="text-sm">{formatDate(record.fields.wunsch_abreise)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'nachricht')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.nachricht ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'status')}</Label>
            <Badge variant="secondary">{lookupLabel('buchungsanfragen', 'status', record.fields.status?.key) ?? record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('buchungsanfragen', 'eingangsdatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.eingangsdatum)}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.BUCHUNGSANFRAGEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}