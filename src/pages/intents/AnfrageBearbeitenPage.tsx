/**
 * Anfrage bearbeiten — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2) Entscheidung: Bestätigen (+ Aufenthalt anlegen) oder Ablehnen.
 * Reads: buchungsanfragen (nur status.key === 'offen'). Writes: buchungsanfragen (updateBuchungsanfragenEntry),
 *        aufenthalte (createAufenthalteEntry) bei Bestätigung.
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import type { Buchungsanfragen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  IconDog,
  IconCalendar,
  IconPhone,
  IconMail,
  IconCheck,
  IconX,
  IconUser,
} from '@tabler/icons-react';

const PLATZNUMMER_OPTIONS = LOOKUP_OPTIONS['aufenthalte']?.['platznummer'] ?? [];

export default function AnfrageBearbeitenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStep = parseInt(searchParams.get('step') ?? '1', 10);

  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(initialStep);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 2 — Bestätigen mini-form state
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummerKey, setPlatznummerKey] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');

  // Action state
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<'bestaetigt' | 'abgelehnt' | null>(null);

  const handleStepChange = (s: number) => {
    setStep(s);
    setSearchParams(prev => { prev.set('step', String(s)); return prev; });
  };

  const offeneAnfragen = buchungsanfragen.filter(
    a => a.fields.status?.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const anfrage = buchungsanfragen.find(a => a.record_id === id) ?? null;
    setSelectedAnfrage(anfrage);
    if (anfrage) {
      // Pre-fill date fields from the Anfrage
      setAnreisedatum(anfrage.fields.wunsch_anreise ?? '');
      setAbreisedatum(anfrage.fields.wunsch_abreise ?? '');
      setPlatznummerKey('none');
      setPreisEuro('');
      setNotizen('');
      setActionError(null);
      setDone(null);
    }
    handleStepChange(2);
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage) return;
    if (platznummerKey === 'none') {
      setActionError(tx('Bitte wähle eine Platznummer aus.'));
      return;
    }
    if (!anreisedatum || !abreisedatum) {
      setActionError(tx('Bitte gib An- und Abreisedatum an.'));
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      // 1) Update Anfrage status → bestaetigt
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        status: 'bestaetigt',
      });
      // 2) Create Aufenthalt
      await LivingAppsService.createAufenthalteEntry({
        anreisedatum,
        abreisedatum,
        platznummer: platznummerKey,
        preis_euro: preisEuro !== '' ? parseFloat(preisEuro) : undefined,
        notizen: notizen || undefined,
        status: 'geplant',
        herkunft: 'aus_anfrage',
      });
      await fetchAll();
      setDone('bestaetigt');
    } catch {
      setActionError(tx('Fehler beim Speichern. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        status: 'abgelehnt',
      });
      await fetchAll();
      setDone('abgelehnt');
    } catch {
      setActionError(tx('Fehler beim Speichern. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bearbeiten')}
      subtitle={tx('Buchungsanfrage prüfen und entscheiden')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheidung') }]}
      currentStep={step}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Anfrage wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map(a => ({
            id: a.record_id,
            title: [a.fields.interessent_vorname, a.fields.interessent_nachname]
              .filter(Boolean)
              .join(' ') || tx('Unbekannte Person'),
            subtitle: [
              a.fields.hund_name,
              a.fields.wunsch_anreise && a.fields.wunsch_abreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise)}`
                : a.fields.wunsch_anreise
                ? formatDate(a.fields.wunsch_anreise)
                : undefined,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.status
              ? { key: a.fields.status.key, label: a.fields.status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Interessent suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden')}
          emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Entscheidung ── */}
      {step === 2 && (
        selectedAnfrage ? (
          done ? (
            /* ── Erfolgsscreen ── */
            <div className="max-w-lg mx-auto text-center space-y-6 py-12">
              <div className="flex justify-center">
                {done === 'bestaetigt' ? (
                  <div className="rounded-full bg-primary/10 p-5">
                    <IconCheck size={48} className="text-primary" />
                  </div>
                ) : (
                  <div className="rounded-full bg-destructive/10 p-5">
                    <IconX size={48} className="text-destructive" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">
                  {done === 'bestaetigt'
                    ? tx('Anfrage bestätigt')
                    : tx('Anfrage abgelehnt')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {done === 'bestaetigt'
                    ? tx('Der Aufenthalt wurde erfolgreich angelegt.')
                    : tx('Die Anfrage wurde als abgelehnt markiert.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedAnfrage(null);
                    setDone(null);
                    handleStepChange(1);
                  }}
                >
                  {tx('Weitere Anfrage bearbeiten')}
                </Button>
                <a href="#/">
                  <Button>{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            /* ── Entscheidungsformular ── */
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Zusammenfassung der Anfrage */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    {[selectedAnfrage.fields.interessent_vorname, selectedAnfrage.fields.interessent_nachname]
                      .filter(Boolean)
                      .join(' ') || tx('Anfrage')}
                  </h2>
                  {selectedAnfrage.fields.status && (
                    <StatusBadge
                      statusKey={selectedAnfrage.fields.status.key}
                      label={selectedAnfrage.fields.status.label}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {selectedAnfrage.fields.interessent_telefon && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconPhone size={15} className="shrink-0" />
                      <span className="truncate">{selectedAnfrage.fields.interessent_telefon}</span>
                    </div>
                  )}
                  {selectedAnfrage.fields.interessent_email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconMail size={15} className="shrink-0" />
                      <span className="truncate">{selectedAnfrage.fields.interessent_email}</span>
                    </div>
                  )}
                  {(selectedAnfrage.fields.hund_name || selectedAnfrage.fields.hund_rasse) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconDog size={15} className="shrink-0" />
                      <span className="truncate">
                        {[selectedAnfrage.fields.hund_name, selectedAnfrage.fields.hund_rasse]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  {(selectedAnfrage.fields.wunsch_anreise || selectedAnfrage.fields.wunsch_abreise) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconCalendar size={15} className="shrink-0" />
                      <span>
                        {selectedAnfrage.fields.wunsch_anreise && selectedAnfrage.fields.wunsch_abreise
                          ? `${formatDate(selectedAnfrage.fields.wunsch_anreise)} – ${formatDate(selectedAnfrage.fields.wunsch_abreise)}`
                          : selectedAnfrage.fields.wunsch_anreise
                          ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                          : ''}
                      </span>
                    </div>
                  )}
                </div>

                {selectedAnfrage.fields.nachricht && (
                  <div className="text-sm text-muted-foreground bg-secondary rounded-lg p-3">
                    <p className="font-medium text-foreground mb-1">{tx('Nachricht')}</p>
                    <p className="whitespace-pre-wrap">{selectedAnfrage.fields.nachricht}</p>
                  </div>
                )}
              </div>

              {/* Mini-Formular für Bestätigung */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <IconUser size={16} className="text-primary shrink-0" />
                  <h3 className="font-semibold text-sm">{tx('Aufenthalt anlegen')}</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tx('Fülle die Details für den neuen Aufenthalt aus — nur bei Bestätigung wird er angelegt.')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="anreisedatum">{tx('Anreisedatum')}</Label>
                    <Input
                      id="anreisedatum"
                      type="date"
                      value={anreisedatum}
                      onChange={e => setAnreisedatum(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="abreisedatum">{tx('Abreisedatum')}</Label>
                    <Input
                      id="abreisedatum"
                      type="date"
                      value={abreisedatum}
                      onChange={e => setAbreisedatum(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="platznummer">{tx('Platznummer')}</Label>
                  <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                    <SelectTrigger id="platznummer" className="w-full">
                      <SelectValue placeholder={tx('Platz wählen …')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx('— Platz wählen —')}</SelectItem>
                      {PLATZNUMMER_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="preis">{tx('Preis (€)')}</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisEuro}
                    onChange={e => setPreisEuro(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notizen">{tx('Notizen')}</Label>
                  <Textarea
                    id="notizen"
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder={tx('Interne Hinweise zum Aufenthalt …')}
                    rows={3}
                  />
                </div>
              </div>

              {/* Fehlermeldung */}
              {actionError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {actionError}
                </div>
              )}

              {/* Aktionen */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1"
                  onClick={handleBestaetigen}
                  disabled={submitting}
                >
                  <IconCheck size={16} className="shrink-0 mr-2" />
                  {tx('Bestätigen & Aufenthalt anlegen')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleAblehnen}
                  disabled={submitting}
                >
                  <IconX size={16} className="shrink-0 mr-2" />
                  {tx('Anfrage ablehnen')}
                </Button>
              </div>

              <div className="text-center">
                <button
                  className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => handleStepChange(1)}
                >
                  {tx('Andere Anfrage wählen')}
                </button>
              </div>
            </div>
          )
        ) : (
          /* Kein selectedAnfrage — Nutzer kam via Deep-Link auf Schritt 2 */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine ausgewählte Anfrage aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => handleStepChange(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
