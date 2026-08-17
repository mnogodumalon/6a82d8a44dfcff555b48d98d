import type { Hunde, Besitzer } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface HundeViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Hunde | null;
  onEdit: (record: Hunde) => void;
  besitzerList: Besitzer[];
}

export function HundeViewDialog({ open, onClose, record, onEdit, besitzerList }: HundeViewDialogProps) {
  function getBesitzerDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return besitzerList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('hunde') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'name')}</Label>
            <p className="text-sm">{record.fields.name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'rasse')}</Label>
            <p className="text-sm">{record.fields.rasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'geburtsdatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.geburtsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'geschlecht')}</Label>
            <Badge variant="secondary">{lookupLabel('hunde', 'geschlecht', record.fields.geschlecht?.key) ?? record.fields.geschlecht?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'gewicht_kg')}</Label>
            <p className="text-sm">{record.fields.gewicht_kg ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'impfstatus')}</Label>
            <Badge variant="secondary">{lookupLabel('hunde', 'impfstatus', record.fields.impfstatus?.key) ?? record.fields.impfstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'fuetterungshinweise')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.fuetterungshinweise ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'medikamente_besonderheiten')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.medikamente_besonderheiten ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'foto')}</Label>
            {record.fields.foto ? (
              <MediaThumbnail src={record.fields.foto} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('hunde', 'besitzer')}</Label>
            <p className="text-sm">{getBesitzerDisplayName(record.fields.besitzer)}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.HUNDE} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}