/**
 * Neue Buchung — 3-Schritt-Wizard für eine Hundepension-Buchung.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen →
 *        3) Aufenthaltsdaten erfassen & Buchung speichern.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry),
 *        hunde (createHundeEntry), aufenthalte (createAufenthalteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { IconDog, IconUser, IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { differenceInDays, parseISO } from 'date-fns';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['aufenthalte']?.['platznummer'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];
const IMPFSTATUS_OPTIONS = LOOKUP_OPTIONS['hunde']?.['impfstatus'] ?? [];

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  // Wizard step
  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bCreating, setBCreating] = useState(false);
  const [bError, setBError] = useState<string | null>(null);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeburtsdatum, setHGeburtsdatum] = useState('');
  const [hGeschlechtKey, setHGeschlechtKey] = useState('none');
  const [hImpfstatusKey, setHImpfstatusKey] = useState('none');
  const [hFuetterung, setHFuetterung] = useState('');
  const [hCreating, setHCreating] = useState(false);
  const [hError, setHError] = useState<string | null>(null);

  // Step 3 — Aufenthalt
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummerKey, setPlatznummerKey] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAufenthaltId, setSavedAufenthaltId] = useState<string | null>(null);

  // Derived: Hunde des gewählten Besitzers
  const hundeDesBesitzers = hunde.filter(
    h => extractRecordId(h.fields.besitzer) === selectedBesitzerId
  );

  // Gewählter Besitzer für Anzeige
  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);

  // Nächte berechnen
  const naechte =
    anreisedatum && abreisedatum
      ? differenceInDays(parseISO(abreisedatum), parseISO(anreisedatum))
      : 0;

  // Handler: Besitzer anlegen
  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBCreating(true);
    setBError(null);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname.trim(),
        nachname: bNachname.trim(),
        telefon: bTelefon.trim() || undefined,
        email: bEmail.trim() || undefined,
      });
      await fetchAll();
      setSelectedBesitzerId(result.record_id);
      setShowCreateBesitzer(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setStep(2);
    } catch {
      setBError(tx('Besitzer konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setBCreating(false);
    }
  };

  // Handler: Hund anlegen
  const handleCreateHund = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHCreating(true);
    setHError(null);
    try {
      const fields: Record<string, unknown> = {
        name: hName.trim(),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      };
      if (hRasse.trim()) fields.rasse = hRasse.trim();
      if (hGeburtsdatum) fields.geburtsdatum = hGeburtsdatum;
      if (hGeschlechtKey !== 'none') fields.geschlecht = hGeschlechtKey;
      if (hImpfstatusKey !== 'none') fields.impfstatus = hImpfstatusKey;
      if (hFuetterung.trim()) fields.fuetterungshinweise = hFuetterung.trim();

      const result = await LivingAppsService.createHundeEntry(fields as Parameters<typeof LivingAppsService.createHundeEntry>[0]);
      await fetchAll();
      setSelectedHundId(result.record_id);
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeburtsdatum('');
      setHGeschlechtKey('none');
      setHImpfstatusKey('none');
      setHFuetterung('');
      setStep(3);
    } catch {
      setHError(tx('Hund konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setHCreating(false);
    }
  };

  // Handler: Aufenthalt speichern
  const handleSaveAufenthalt = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreisedatum || !abreisedatum || platznummerKey === 'none') return;

    // Idempotenz: bereits gespeichert → nicht nochmals anlegen
    let aid = savedAufenthaltId;
    if (!aid) {
      setSaving(true);
      setSaveError(null);
      try {
        const fields: Record<string, unknown> = {
          hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
          besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
          anreisedatum,
          abreisedatum,
          platznummer: platznummerKey,
          status: 'geplant',
          herkunft: 'direkt',
        };
        if (preisEuro && !isNaN(Number(preisEuro))) fields.preis_euro = Number(preisEuro);
        if (notizen.trim()) fields.notizen = notizen.trim();

        const result = await LivingAppsService.createAufenthalteEntry(fields as Parameters<typeof LivingAppsService.createAufenthalteEntry>[0]);
        aid = result.record_id;
        setSavedAufenthaltId(aid);
        await fetchAll();
      } catch {
        setSaveError(tx('Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.'));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setStep(4);
  };

  // Reset
  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
    setAnreisedatum('');
    setAbreisedatum('');
    setPlatznummerKey('none');
    setPreisEuro('');
    setNotizen('');
    setSavedAufenthaltId(null);
    setSaveError(null);
    setBError(null);
    setHError(null);
  };

  const platznummerLabel =
    PLATZ_OPTIONS.find(p => p.key === platznummerKey)?.label ?? platznummerKey;

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Besitzer, Hund und Aufenthaltszeitraum in drei Schritten erfassen')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Aufenthalt') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ───── Schritt 1: Besitzer ───── */}
      {step === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={besitzer.map(b => ({
              id: b.record_id,
              title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannter Besitzer'),
              subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · ') || undefined,
              icon: <IconUser size={20} className="text-primary" />,
            }))}
            onSelect={(id) => {
              setSelectedBesitzerId(id);
              setSelectedHundId(null);
              setStep(2);
            }}
            searchPlaceholder={tx('Vorname, Nachname oder Telefon …')}
            createLabel={tx('Neuen Besitzer anlegen')}
            onCreateNew={() => setShowCreateBesitzer(true)}
            createDialog={showCreateBesitzer && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                    autoFocus
                  />
                  <Input
                    value={bNachname}
                    onChange={e => setBNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                  <Input
                    type="tel"
                    value={bTelefon}
                    onChange={e => setBTelefon(e.target.value)}
                    placeholder={tx('Telefon')}
                  />
                  <Input
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('E-Mail (optional)')}
                  />
                </div>
                {bError && (
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <IconAlertCircle size={14} className="shrink-0" />
                    {bError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    disabled={!bVorname.trim() || !bNachname.trim() || bCreating}
                    onClick={handleCreateBesitzer}
                  >
                    {bCreating ? tx('Anlegen …') : tx('Anlegen & weiter')}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateBesitzer(false)}>
                    {tx('Abbrechen')}
                  </Button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* ───── Schritt 2: Hund ───── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {selectedBesitzer && (
              <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
                <IconUser size={14} className="shrink-0" />
                <span>
                  {tx('Besitzer:')} <span className="font-medium text-foreground">
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                </span>
              </div>
            )}
            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? tx('Unbekannter Hund'),
                subtitle: [h.fields.rasse, h.fields.impfstatus?.label].filter(Boolean).join(' · ') || undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              searchPlaceholder={tx('Hundename oder Rasse …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              emptyText={tx('Noch kein Hund für diesen Besitzer hinterlegt.')}
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      value={hName}
                      onChange={e => setHName(e.target.value)}
                      placeholder={tx('Name des Hundes')}
                      autoFocus
                    />
                    <Input
                      value={hRasse}
                      onChange={e => setHRasse(e.target.value)}
                      placeholder={tx('Rasse (optional)')}
                    />
                    <Input
                      type="date"
                      value={hGeburtsdatum}
                      onChange={e => setHGeburtsdatum(e.target.value)}
                      placeholder={tx('Geburtsdatum (optional)')}
                    />
                    <Select value={hGeschlechtKey} onValueChange={setHGeschlechtKey}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Geschlecht (optional)')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                        {GESCHLECHT_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={hImpfstatusKey} onValueChange={setHImpfstatusKey}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Impfstatus (optional)')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                        {IMPFSTATUS_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={hFuetterung}
                    onChange={e => setHFuetterung(e.target.value)}
                    placeholder={tx('Fütterungshinweise (optional)')}
                    rows={2}
                  />
                  {hError && (
                    <p className="flex items-center gap-2 text-sm text-destructive">
                      <IconAlertCircle size={14} className="shrink-0" />
                      {hError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      disabled={!hName.trim() || hCreating}
                      onClick={handleCreateHund}
                    >
                      {hCreating ? tx('Anlegen …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              {tx('← Besitzer ändern')}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ───── Schritt 3: Aufenthalt ───── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-5 max-w-lg mx-auto">
            {/* Kontext-Zeile */}
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-1">
                <IconUser size={13} className="shrink-0" />
                {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-1">
                <IconDog size={13} className="shrink-0" />
                {selectedHund?.fields.name ?? tx('Hund')}
              </span>
            </div>

            {/* Zeitraum */}
            <div className="rounded-2xl border bg-card p-4 space-y-4">
              <p className="font-medium text-sm">{tx('Aufenthaltszeitraum')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{tx('Anreise')}</label>
                  <Input
                    type="date"
                    value={anreisedatum}
                    onChange={e => setAnreisedatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{tx('Abreise')}</label>
                  <Input
                    type="date"
                    value={abreisedatum}
                    onChange={e => setAbreisedatum(e.target.value)}
                    min={anreisedatum || undefined}
                  />
                </div>
              </div>
              {naechte > 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <IconCalendar size={14} className="shrink-0" />
                  {tx(tx`${naechte} Nacht${naechte === 1 ? '' : 'nächte'}`)}
                </p>
              )}
            </div>

            {/* Platz und Preis */}
            <div className="rounded-2xl border bg-card p-4 space-y-4">
              <p className="font-medium text-sm">{tx('Platz & Preis')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{tx('Platznummer')}</label>
                  <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                    <SelectTrigger>
                      <SelectValue placeholder={tx('Platz wählen')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx('Platz wählen …')}</SelectItem>
                      {PLATZ_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{tx('Preis (€, optional)')}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisEuro}
                    onChange={e => setPreisEuro(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{tx('Notizen (optional)')}</label>
                <Textarea
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Besonderheiten, Wünsche …')}
                  rows={3}
                />
              </div>
            </div>

            {saveError && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <IconAlertCircle size={14} className="shrink-0" />
                {saveError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!anreisedatum || !abreisedatum || platznummerKey === 'none' || naechte <= 0 || saving}
                onClick={handleSaveAufenthalt}
              >
                {saving ? tx('Buchung speichern …') : tx('Buchung speichern')}
              </Button>
              <Button variant="outline" onClick={() => setStep(2)}>
                {tx('← Hund ändern')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ───── Schritt 4: Fertig ───── */}
      {step === 4 && (
        <div className="flex flex-col items-center text-center py-12 space-y-6">
          <div className="rounded-full bg-primary/10 p-5">
            <IconCheck size={40} className="text-primary" stroke={2} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{tx('Buchung gespeichert!')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {selectedHund?.fields.name
                ? tx(tx`${selectedHund.fields.name} ist ab ${anreisedatum} auf ${platznummerLabel} eingeplant.`)
                : tx(tx`Der Aufenthalt wurde erfolgreich gebucht. Platz: ${platznummerLabel}.`)}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
            <a href="#/">
              <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
