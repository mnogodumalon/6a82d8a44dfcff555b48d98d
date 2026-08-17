/**
 * Anfrage bestätigen — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage auswählen → 2) Prüfen & entscheiden (Ablehnen oder Bestätigen + Aufenthalt anlegen).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (updateBuchungsanfragenEntry), aufenthalte (createAufenthalteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconCalendar, IconUser, IconDog, IconMessageCircle, IconCheck, IconX, IconMail, IconPhone } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['aufenthalte']?.['platznummer'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Schritt 2: Bestätigen-Formular
  const [platznummer, setPlatznummer] = useState('');
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');

  // Aktionsstatus
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Nur offene Anfragen anzeigen
  const offeneAnfragen = buchungsanfragen.filter(
    a => a.fields.status?.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const gefunden = buchungsanfragen.find(a => a.record_id === id) ?? null;
    if (!gefunden) return;
    setSelectedAnfrage(gefunden);
    setAnreisedatum(gefunden.fields.wunsch_anreise ?? '');
    setAbreisedatum(gefunden.fields.wunsch_abreise ?? '');
    setPlatznummer('');
    setPreisEuro('');
    setNotizen('');
    setSuccessMsg('');
    setSubmitError('');
    setStep(2);
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        status: 'abgelehnt',
      });
      await fetchAll();
      setSuccessMsg(
        tx`Die Anfrage von ${(selectedAnfrage.fields.interessent_vorname ?? '') + ' ' + (selectedAnfrage.fields.interessent_nachname ?? '')} wurde abgelehnt.`
      );
    } catch {
      setSubmitError(tx('Beim Ablehnen ist ein Fehler aufgetreten. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage || !platznummer || !anreisedatum || !abreisedatum) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await LivingAppsService.createAufenthalteEntry({
        platznummer,
        anreisedatum,
        abreisedatum,
        status: 'geplant',
        herkunft: 'aus_anfrage',
        preis_euro: preisEuro ? Number(preisEuro) : undefined,
        notizen: notizen || undefined,
      });
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        status: 'bestaetigt',
      });
      await fetchAll();
      const name = selectedAnfrage.fields.hund_name ?? tx('Unbekannter Hund');
      const von = anreisedatum ? formatDate(anreisedatum) : '?';
      const bis = abreisedatum ? formatDate(abreisedatum) : '?';
      setSuccessMsg(tx`Aufenthalt für ${name} (${von} – ${bis}) wurde angelegt und die Anfrage bestätigt.`);
    } catch {
      setSubmitError(tx('Beim Bestätigen ist ein Fehler aufgetreten. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAnfrage(null);
    setSuccessMsg('');
    setSubmitError('');
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Buchungsanfrage bestätigen')}
      subtitle={tx('Offene Anfrage prüfen und direkt einen Aufenthalt anlegen')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheiden') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Anfrage auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map(a => ({
            id: a.record_id,
            title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannt'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise && a.fields.wunsch_abreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise)}`
                : a.fields.wunsch_anreise
                ? `${tx('Ab')}: ${formatDate(a.fields.wunsch_anreise)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.status
              ? { key: a.fields.status.key, label: a.fields.status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Name oder Hund suchen …')}
          emptyText={tx('Keine offenen Buchungsanfragen vorhanden')}
          emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Schritt 2: Prüfen & entscheiden */}
      {step === 2 && (
        <div className="space-y-6">
          {successMsg ? (
            <div className="rounded-2xl border bg-card p-6 space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <IconCheck size={32} className="text-primary" />
                </div>
              </div>
              <p className="text-base font-medium text-foreground">{successMsg}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleReset}>
                  {tx('Weitere Anfrage bearbeiten')}
                </Button>
                <a href="#/">
                  <Button variant="outline" className="w-full sm:w-auto">
                    {tx('Zurück zum Dashboard')}
                  </Button>
                </a>
              </div>
            </div>
          ) : selectedAnfrage ? (
            <>
              {/* Read-only Zusammenfassung der Anfrage */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {tx('Buchungsanfrage')}
                  </h2>
                  {selectedAnfrage.fields.status && (
                    <StatusBadge
                      statusKey={selectedAnfrage.fields.status.key}
                      label={selectedAnfrage.fields.status.label}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <IconUser size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">{tx('Interessent')}</div>
                      <div className="font-medium text-foreground">
                        {[selectedAnfrage.fields.interessent_vorname, selectedAnfrage.fields.interessent_nachname]
                          .filter(Boolean)
                          .join(' ') || '—'}
                      </div>
                    </div>
                  </div>

                  {selectedAnfrage.fields.interessent_telefon && (
                    <div className="flex items-start gap-2">
                      <IconPhone size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">{tx('Telefon')}</div>
                        <div className="font-medium text-foreground">{selectedAnfrage.fields.interessent_telefon}</div>
                      </div>
                    </div>
                  )}

                  {selectedAnfrage.fields.interessent_email && (
                    <div className="flex items-start gap-2">
                      <IconMail size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">{tx('E-Mail')}</div>
                        <div className="font-medium text-foreground">{selectedAnfrage.fields.interessent_email}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <IconDog size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">{tx('Hund')}</div>
                      <div className="font-medium text-foreground">
                        {[selectedAnfrage.fields.hund_name, selectedAnfrage.fields.hund_rasse]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <IconCalendar size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">{tx('Gewünschter Zeitraum')}</div>
                      <div className="font-medium text-foreground">
                        {selectedAnfrage.fields.wunsch_anreise && selectedAnfrage.fields.wunsch_abreise
                          ? `${formatDate(selectedAnfrage.fields.wunsch_anreise)} – ${formatDate(selectedAnfrage.fields.wunsch_abreise)}`
                          : selectedAnfrage.fields.wunsch_anreise
                          ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {selectedAnfrage.fields.eingangsdatum && (
                    <div className="flex items-start gap-2">
                      <IconCalendar size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">{tx('Eingegangen am')}</div>
                        <div className="font-medium text-foreground">{formatDate(selectedAnfrage.fields.eingangsdatum)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedAnfrage.fields.nachricht && (
                  <div className="flex items-start gap-2 pt-1 border-t">
                    <IconMessageCircle size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{tx('Nachricht')}</div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selectedAnfrage.fields.nachricht}</p>
                    </div>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              {/* Aktion: Ablehnen */}
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <IconX size={16} className="text-destructive shrink-0" />
                  {tx('Anfrage ablehnen')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tx('Die Anfrage wird als abgelehnt markiert. Es wird kein Aufenthalt angelegt.')}
                </p>
                <Button
                  variant="destructive"
                  onClick={handleAblehnen}
                  disabled={submitting}
                >
                  <IconX size={16} className="shrink-0" />
                  {tx('Jetzt ablehnen')}
                </Button>
              </div>

              {/* Aktion: Bestätigen + Aufenthalt anlegen */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <IconCheck size={16} className="text-primary shrink-0" />
                  {tx('Anfrage bestätigen & Aufenthalt anlegen')}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Platznummer (Pflicht) */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Platznummer')} <span className="text-destructive">*</span>
                    </label>
                    <Select value={platznummer} onValueChange={setPlatznummer}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Platz wählen …')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATZ_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preis */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Preis (€)')}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={preisEuro}
                      onChange={e => setPreisEuro(e.target.value)}
                      placeholder={tx('z. B. 25.00')}
                    />
                  </div>

                  {/* Anreisedatum (Pflicht) */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Anreisedatum')} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={anreisedatum}
                      onChange={e => setAnreisedatum(e.target.value)}
                    />
                  </div>

                  {/* Abreisedatum (Pflicht) */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Abreisedatum')} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={abreisedatum}
                      onChange={e => setAbreisedatum(e.target.value)}
                    />
                  </div>
                </div>

                {/* Notizen */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {tx('Notizen')}
                  </label>
                  <Textarea
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder={tx('Interne Hinweise zum Aufenthalt …')}
                    rows={3}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {tx('Hund und Besitzer können nach der Bestätigung auf der Aufenthaltsseite ergänzt werden.')}
                </p>

                <Button
                  onClick={handleBestaetigen}
                  disabled={submitting || !platznummer || !anreisedatum || !abreisedatum}
                  className="w-full sm:w-auto"
                >
                  <IconCheck size={16} className="shrink-0" />
                  {tx('Bestätigen & Aufenthalt anlegen')}
                </Button>
              </div>

              {/* Zurück-Link */}
              <div className="pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  {tx('Andere Anfrage wählen')}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt braucht eine ausgewählte Anfrage aus Schritt 1.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
