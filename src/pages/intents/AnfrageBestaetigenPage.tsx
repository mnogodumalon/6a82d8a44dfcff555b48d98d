/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage auswählen → 2) Besitzer & Hund anlegen →
 *         3) Aufenthalt bestätigen & Anfrage als 'bestaetigt' markieren.
 * Reads: buchungsanfragen (gefiltert auf status 'offen').
 * Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry),
 *         aufenthalte (createAufenthalteEntry), buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Buchungsanfragen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconDog, IconUser, IconCheck, IconAlertCircle, IconHome } from '@tabler/icons-react';

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  // Wizard step (1-based)
  const [step, setStep] = useState(1);

  // Schritt 1 — gewählte Anfrage
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Schritt 2 — Besitzer-Formular
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');

  // Schritt 2 — Hund-Formular
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');

  // Schritt 2 — IDs aus dem Create-Ergebnis (Idempotenz-Guard)
  const [besitzerId, setBesitzerId] = useState<string | null>(null);
  const [hundId, setHundId] = useState<string | null>(null);

  // Schritt 3 — Aufenthalt-Formular
  const [platznummer, setPlatznummer] = useState('');
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');

  // Schritt 3 — Ergebnis-IDs (Idempotenz-Guard)
  const [aufenthaltId, setAufenthaltId] = useState<string | null>(null);

  // Submit-Status
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [anfrageUpdateFailed, setAnfrageUpdateFailed] = useState(false);
  const [done, setDone] = useState(false);

  // Lookup-Optionen
  const PLATZ_OPTIONS = LOOKUP_OPTIONS['aufenthalte']?.['platznummer'] ?? [];
  const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];

  // Offene Anfragen filtern
  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.status?.key === 'offen',
  );

  // ─── Schritt-1-Auswahl ────────────────────────────────────────────────────
  const handleSelectAnfrage = (id: string) => {
    const anfrage = offeneAnfragen.find((a) => a.record_id === id);
    if (!anfrage) return;
    setSelectedAnfrage(anfrage);
    // Formularfelder vorausfüllen
    setBVorname(anfrage.fields.interessent_vorname ?? '');
    setBNachname(anfrage.fields.interessent_nachname ?? '');
    setBTelefon(anfrage.fields.interessent_telefon ?? '');
    setBEmail(anfrage.fields.interessent_email ?? '');
    setHName(anfrage.fields.hund_name ?? '');
    setHRasse(anfrage.fields.hund_rasse ?? '');
    setAnreisedatum(anfrage.fields.wunsch_anreise ?? '');
    setAbreisedatum(anfrage.fields.wunsch_abreise ?? '');
    // Zurücksetzen falls vorher jemand anderes gewählt
    setBesitzerId(null);
    setHundId(null);
    setAufenthaltId(null);
    setDone(false);
    setSubmitError(null);
    setAnfrageUpdateFailed(false);
    setStep(2);
  };

  // ─── Schritt-2-Submit ─────────────────────────────────────────────────────
  const handleSchritt2 = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Idempotenz: Besitzer nur anlegen wenn noch nicht vorhanden
      let bId = besitzerId;
      if (!bId) {
        const besitzer = await LivingAppsService.createBesitzerEntry({
          vorname: bVorname.trim(),
          nachname: bNachname.trim(),
          telefon: bTelefon.trim() || undefined,
          email: bEmail.trim() || undefined,
        });
        bId = besitzer.record_id;
        setBesitzerId(bId);
      }

      // Idempotenz: Hund nur anlegen wenn noch nicht vorhanden
      let hId = hundId;
      if (!hId) {
        const hund = await LivingAppsService.createHundeEntry({
          name: hName.trim(),
          rasse: hRasse.trim() || undefined,
          geschlecht: hGeschlecht !== 'none' ? hGeschlecht : undefined,
          besitzer: createRecordUrl(APP_IDS.BESITZER, bId),
        });
        hId = hund.record_id;
        setHundId(hId);
      }

      await fetchAll();
      setStep(3);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tx('Fehler beim Anlegen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Schritt-3-Submit ─────────────────────────────────────────────────────
  const handleSchritt3 = async () => {
    if (!selectedAnfrage || !besitzerId || !hundId) return;
    if (!platznummer || !anreisedatum || !abreisedatum) return;
    setSubmitting(true);
    setSubmitError(null);
    setAnfrageUpdateFailed(false);
    try {
      // Idempotenz: Aufenthalt nur anlegen wenn noch nicht vorhanden
      let aId = aufenthaltId;
      if (!aId) {
        const aufenthalt = await LivingAppsService.createAufenthalteEntry({
          hund: createRecordUrl(APP_IDS.HUNDE, hundId),
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
          platznummer,
          anreisedatum,
          abreisedatum,
          status: 'geplant',
          herkunft: 'aus_anfrage',
          preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
          notizen: notizen.trim() || undefined,
        });
        aId = aufenthalt.record_id;
        setAufenthaltId(aId);
      }

      // Anfrage als bestätigt markieren — bei Fehler trotzdem Aufenthalt behalten
      try {
        await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
          status: 'bestaetigt',
        });
      } catch {
        setAnfrageUpdateFailed(true);
      }

      await fetchAll();
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tx('Fehler beim Bestätigen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Wizard zurücksetzen ──────────────────────────────────────────────────
  const handleReset = () => {
    setSelectedAnfrage(null);
    setBVorname('');
    setBNachname('');
    setBTelefon('');
    setBEmail('');
    setHName('');
    setHRasse('');
    setHGeschlecht('none');
    setPlatznummer('');
    setAnreisedatum('');
    setAbreisedatum('');
    setPreisEuro('');
    setNotizen('');
    setBesitzerId(null);
    setHundId(null);
    setAufenthaltId(null);
    setSubmitError(null);
    setAnfrageUpdateFailed(false);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfrage prüfen, Besitzer & Hund anlegen, Aufenthalt bestätigen')}
      steps={[
        { label: tx('Anfrage') },
        { label: tx('Besitzer & Hund') },
        { label: tx('Aufenthalt') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Anfrage wählen ────────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || a.record_id,
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
          searchPlaceholder={tx('Interessent oder Hund suchen …')}
          emptyText={tx('Keine offenen Buchungsanfragen vorhanden.')}
          emptyIcon={<IconDog size={40} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Besitzer & Hund anlegen ──────────────────────────── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-xl mx-auto">
            {/* Anfrage-Kontext */}
            <div className="rounded-2xl border bg-secondary/40 p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {tx('Anfrage von')}
              </p>
              <p className="font-semibold text-foreground">
                {selectedAnfrage.fields.interessent_vorname} {selectedAnfrage.fields.interessent_nachname}
              </p>
              {selectedAnfrage.fields.hund_name && (
                <p className="text-sm text-muted-foreground">
                  {tx('Hund')}: {selectedAnfrage.fields.hund_name}
                  {selectedAnfrage.fields.hund_rasse ? ` (${selectedAnfrage.fields.hund_rasse})` : ''}
                </p>
              )}
              {selectedAnfrage.fields.wunsch_anreise && (
                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedAnfrage.fields.wunsch_anreise)}
                  {selectedAnfrage.fields.wunsch_abreise
                    ? ` – ${formatDate(selectedAnfrage.fields.wunsch_abreise)}`
                    : ''}
                </p>
              )}
            </div>

            {/* Besitzer-Formular */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <IconUser size={18} className="text-primary shrink-0" />
                <h3 className="font-semibold text-foreground">{tx('Besitzer anlegen')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="b-vorname"
                    value={bVorname}
                    onChange={(e) => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="b-nachname"
                    value={bNachname}
                    onChange={(e) => setBNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-telefon">{tx('Telefon')}</Label>
                  <Input
                    id="b-telefon"
                    type="tel"
                    value={bTelefon}
                    onChange={(e) => setBTelefon(e.target.value)}
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={(e) => setBEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
            </div>

            {/* Hund-Formular */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <IconDog size={18} className="text-primary shrink-0" />
                <h3 className="font-semibold text-foreground">{tx('Hund anlegen')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="h-name">{tx('Name')} *</Label>
                  <Input
                    id="h-name"
                    value={hName}
                    onChange={(e) => setHName(e.target.value)}
                    placeholder={tx('Hundename')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h-rasse">{tx('Rasse')}</Label>
                  <Input
                    id="h-rasse"
                    value={hRasse}
                    onChange={(e) => setHRasse(e.target.value)}
                    placeholder={tx('Rasse')}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                  <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                    <SelectTrigger id="h-geschlecht" className="w-full">
                      <SelectValue placeholder={tx('Geschlecht wählen')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx('Keine Angabe')}</SelectItem>
                      {GESCHLECHT_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
              <Button
                className="w-full sm:w-auto flex-1"
                disabled={submitting || !bVorname.trim() || !bNachname.trim() || !hName.trim()}
                onClick={handleSchritt2}
              >
                {submitting ? tx('Wird angelegt …') : tx('Weiter zu Schritt 3')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt benötigt eine Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Aufenthalt bestätigen ────────────────────────────── */}
      {step === 3 && (
        selectedAnfrage && besitzerId && hundId ? (
          done ? (
            /* Erfolgs-Zustand */
            <div className="max-w-md mx-auto text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-5">
                  <IconCheck size={40} className="text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  {tx('Aufenthalt bestätigt!')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Der Aufenthalt wurde angelegt und die Buchungsanfrage als bestätigt markiert.')}
                </p>
                {anfrageUpdateFailed && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive text-left mt-3">
                    <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      {tx('Hinweis: Der Aufenthalt wurde erfolgreich angelegt, aber die Buchungsanfrage konnte nicht automatisch als "Bestätigt" markiert werden. Bitte manuell nachpflegen.')}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={handleReset} className="w-full">
                  {tx('Weitere Anfrage bestätigen')}
                </Button>
                <a href="#/" className="block">
                  <Button variant="outline" className="w-full">
                    <IconHome size={16} className="shrink-0" />
                    {tx('Zurück zum Dashboard')}
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            /* Aufenthalt-Formular */
            <div className="space-y-6 max-w-xl mx-auto">
              {/* Zusammenfassung */}
              <div className="rounded-2xl border bg-secondary/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {tx('Zusammenfassung')}
                </p>
                <p className="font-semibold text-foreground">
                  {bVorname} {bNachname}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tx('Hund')}: {hName}
                  {hRasse ? ` (${hRasse})` : ''}
                </p>
              </div>

              {/* Aufenthalt-Formular */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">{tx('Aufenthalt anlegen')}</h3>

                <div className="space-y-1">
                  <Label htmlFor="platznummer">{tx('Platznummer')} *</Label>
                  <Select value={platznummer} onValueChange={setPlatznummer}>
                    <SelectTrigger id="platznummer" className="w-full">
                      <SelectValue placeholder={tx('Platz wählen')} />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATZ_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="anreisedatum">{tx('Anreisedatum')} *</Label>
                    <Input
                      id="anreisedatum"
                      type="date"
                      value={anreisedatum}
                      onChange={(e) => setAnreisedatum(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="abreisedatum">{tx('Abreisedatum')} *</Label>
                    <Input
                      id="abreisedatum"
                      type="date"
                      value={abreisedatum}
                      onChange={(e) => setAbreisedatum(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="preis">{tx('Preis (€)')}</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisEuro}
                    onChange={(e) => setPreisEuro(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notizen">{tx('Notizen')}</Label>
                  <Textarea
                    id="notizen"
                    value={notizen}
                    onChange={(e) => setNotizen(e.target.value)}
                    placeholder={tx('Besonderheiten, Hinweise …')}
                    rows={3}
                  />
                </div>
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  className="w-full sm:w-auto flex-1"
                  disabled={submitting || !platznummer || !anreisedatum || !abreisedatum}
                  onClick={handleSchritt3}
                >
                  {submitting ? tx('Wird bestätigt …') : tx('Aufenthalt anlegen & Anfrage bestätigen')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt benötigt die Daten aus den vorherigen Schritten.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
