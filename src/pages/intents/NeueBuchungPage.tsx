/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder anlegen → 2) Hund wählen oder anlegen →
 *         3) Aufenthalt mit Zeitraum und Platz anlegen → Erfolgsmeldung.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry),
 *   hunde (createHundeEntry), aufenthalte (createAufenthalteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
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
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { Besitzer, Hunde } from '@/types/app';
import { tx } from '@/i18n';
import { IconUser, IconDog, IconCalendar, IconCheck } from '@tabler/icons-react';
import { differenceInDays } from 'date-fns';

const PLATZNUMMER_OPTIONS = LOOKUP_OPTIONS['aufenthalte']?.['platznummer'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];
const IMPFSTATUS_OPTIONS = LOOKUP_OPTIONS['hunde']?.['impfstatus'] ?? [];

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  // Wizard step state
  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzer, setSelectedBesitzer] = useState<Besitzer | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bSaving, setBSaving] = useState(false);
  const [bError, setBError] = useState<string | null>(null);

  // Step 2 — Hund
  const [selectedHund, setSelectedHund] = useState<Hunde | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGewicht, setHGewicht] = useState('');
  const [hGeschlechtKey, setHGeschlechtKey] = useState('');
  const [hImpfstatusKey, setHImpfstatusKey] = useState('');
  const [hSaving, setHSaving] = useState(false);
  const [hError, setHError] = useState<string | null>(null);

  // Step 3 — Aufenthalt
  const [platznummerKey, setPlatznummerKey] = useState('');
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [aSaving, setASaving] = useState(false);
  const [aError, setAError] = useState<string | null>(null);

  // Success state
  const [successInfo, setSuccessInfo] = useState<{ hundName: string; anreise: string; abreise: string } | null>(null);

  // Derived: hunde belonging to selected Besitzer
  const hundeDesBesitzers = selectedBesitzer
    ? hunde.filter(h => extractRecordId(h.fields.besitzer) === selectedBesitzer.record_id)
    : [];

  // Nächte berechnen
  const naechte =
    anreisedatum && abreisedatum
      ? differenceInDays(new Date(abreisedatum), new Date(anreisedatum))
      : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreateBesitzer() {
    if (!bVorname || !bNachname) return;
    setBSaving(true);
    setBError(null);
    try {
      const created = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname,
        nachname: bNachname,
        telefon: bTelefon || undefined,
        email: bEmail || undefined,
      });
      await fetchAll();
      // auto-select the newly created record — find by record_id after fetchAll
      const newRecord: Besitzer = {
        record_id: created.record_id,
        created_at: '',
        updated_at: null,
        createdat: '',
        updatedat: null,
        fields: {
          vorname: bVorname,
          nachname: bNachname,
          telefon: bTelefon || undefined,
          email: bEmail || undefined,
        },
      };
      setSelectedBesitzer(newRecord);
      setShowCreateBesitzer(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setStep(2);
    } catch (err) {
      setBError(tx('Fehler beim Anlegen des Besitzers.'));
    } finally {
      setBSaving(false);
    }
  }

  async function handleCreateHund() {
    if (!hName || !selectedBesitzer) return;
    setHSaving(true);
    setHError(null);
    try {
      const created = await LivingAppsService.createHundeEntry({
        name: hName,
        rasse: hRasse || undefined,
        gewicht_kg: hGewicht ? parseFloat(hGewicht) : undefined,
        geschlecht: hGeschlechtKey && hGeschlechtKey !== 'none' ? hGeschlechtKey : undefined,
        impfstatus: hImpfstatusKey && hImpfstatusKey !== 'none' ? hImpfstatusKey : undefined,
        besitzer: createRecordUrl('6a82d882c453d4a0583e98c8', selectedBesitzer.record_id),
      });
      await fetchAll();
      const newHund: Hunde = {
        record_id: created.record_id,
        created_at: '',
        updated_at: null,
        createdat: '',
        updatedat: null,
        fields: {
          name: hName,
          rasse: hRasse || undefined,
          besitzer: createRecordUrl('6a82d882c453d4a0583e98c8', selectedBesitzer.record_id),
        },
      };
      setSelectedHund(newHund);
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGewicht('');
      setHGeschlechtKey('');
      setHImpfstatusKey('');
      setStep(3);
    } catch (err) {
      setHError(tx('Fehler beim Anlegen des Hundes.'));
    } finally {
      setHSaving(false);
    }
  }

  async function handleCreateAufenthalt() {
    if (!selectedBesitzer || !selectedHund || !platznummerKey || !anreisedatum || !abreisedatum) return;
    setASaving(true);
    setAError(null);
    try {
      await LivingAppsService.createAufenthalteEntry({
        hund: createRecordUrl('6a82d88819637c450f81200c', selectedHund.record_id),
        besitzer: createRecordUrl('6a82d882c453d4a0583e98c8', selectedBesitzer.record_id),
        platznummer: platznummerKey,
        anreisedatum,
        abreisedatum,
        status: 'geplant',
        herkunft: 'direkt',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen || undefined,
      });
      setSuccessInfo({
        hundName: selectedHund.fields.name ?? tx('Hund'),
        anreise: anreisedatum,
        abreise: abreisedatum,
      });
      setStep(4);
    } catch (err) {
      setAError(tx('Fehler beim Anlegen des Aufenthalts.'));
    } finally {
      setASaving(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedBesitzer(null);
    setSelectedHund(null);
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
    setPlatznummerKey('');
    setAnreisedatum('');
    setAbreisedatum('');
    setPreisEuro('');
    setNotizen('');
    setSuccessInfo(null);
    setAError(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Besitzer, Hund und Aufenthalt in drei Schritten erfassen')}
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
      {/* ── Schritt 1: Besitzer ─────────────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · ') || undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            const found = besitzer.find(b => b.record_id === id) ?? null;
            setSelectedBesitzer(found);
            setStep(2);
          }}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          searchPlaceholder={tx('Besitzer suchen …')}
          emptyText={tx('Noch kein Besitzer angelegt.')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="b-vorname"
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="b-nachname"
                    value={bNachname}
                    onChange={e => setBNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-telefon">{tx('Telefon')}</Label>
                  <Input
                    id="b-telefon"
                    type="tel"
                    value={bTelefon}
                    onChange={e => setBTelefon(e.target.value)}
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
              {bError && <p className="text-sm text-destructive">{bError}</p>}
              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={!bVorname || !bNachname || bSaving}
                  onClick={handleCreateBesitzer}
                >
                  {bSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* ── Schritt 2: Hund ─────────────────────────────────────────────── */}
      {step === 2 && (
        selectedBesitzer ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <IconUser size={16} className="shrink-0" />
              <span>
                {tx('Besitzer')}: <span className="font-medium text-foreground">
                  {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                </span>
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => { setSelectedBesitzer(null); setStep(1); }}>
                {tx('Ändern')}
              </Button>
            </div>
            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? tx('Unbekannt'),
                subtitle: [h.fields.rasse, h.fields.gewicht_kg ? `${h.fields.gewicht_kg} kg` : undefined].filter(Boolean).join(' · ') || undefined,
                status: h.fields.impfstatus ? { key: h.fields.impfstatus.key, label: h.fields.impfstatus.label } : undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                const found = hundeDesBesitzers.find(h => h.record_id === id) ?? null;
                setSelectedHund(found);
                setStep(3);
              }}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              searchPlaceholder={tx('Hund suchen …')}
              emptyText={hundeDesBesitzers.length === 0 ? tx('Noch kein Hund für diesen Besitzer. Lege jetzt einen an.') : undefined}
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="h-name">{tx('Name')} *</Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Name des Hundes')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-rasse">{tx('Rasse')}</Label>
                      <Input
                        id="h-rasse"
                        value={hRasse}
                        onChange={e => setHRasse(e.target.value)}
                        placeholder={tx('Rasse')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-gewicht">{tx('Gewicht (kg)')}</Label>
                      <Input
                        id="h-gewicht"
                        type="number"
                        min="0"
                        step="0.1"
                        value={hGewicht}
                        onChange={e => setHGewicht(e.target.value)}
                        placeholder={tx('z. B. 12.5')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlechtKey} onValueChange={setHGeschlechtKey}>
                        <SelectTrigger id="h-geschlecht">
                          <SelectValue placeholder={tx('Bitte wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {GESCHLECHT_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="h-impfstatus">{tx('Impfstatus')}</Label>
                      <Select value={hImpfstatusKey} onValueChange={setHImpfstatusKey}>
                        <SelectTrigger id="h-impfstatus">
                          <SelectValue placeholder={tx('Bitte wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {IMPFSTATUS_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {hError && <p className="text-sm text-destructive">{hError}</p>}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      disabled={!hName || hSaving}
                      onClick={handleCreateHund}
                    >
                      {hSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Aufenthalt ───────────────────────────────────────── */}
      {step === 3 && (
        selectedBesitzer && selectedHund ? (
          <div className="space-y-6">
            {/* Kontext-Banner */}
            <div className="rounded-xl bg-secondary px-4 py-3 text-sm flex flex-wrap gap-4 items-center">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconUser size={15} className="shrink-0" />
                <span className="font-medium text-foreground">
                  {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconDog size={15} className="shrink-0" />
                <span className="font-medium text-foreground">{selectedHund.fields.name}</span>
              </span>
            </div>

            {/* Aufenthalt-Formular */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="platz">{tx('Platznummer')} *</Label>
                <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                  <SelectTrigger id="platz">
                    <SelectValue placeholder={tx('Platz auswählen')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATZNUMMER_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="anreise">{tx('Anreisedatum')} *</Label>
                  <div className="relative">
                    <IconCalendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0" />
                    <Input
                      id="anreise"
                      type="date"
                      value={anreisedatum}
                      onChange={e => setAnreisedatum(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="abreise">{tx('Abreisedatum')} *</Label>
                  <div className="relative">
                    <IconCalendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none shrink-0" />
                    <Input
                      id="abreise"
                      type="date"
                      value={abreisedatum}
                      onChange={e => setAbreisedatum(e.target.value)}
                      min={anreisedatum || undefined}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {naechte > 0 && (
                <p className="text-sm text-muted-foreground">
                  {tx(`Aufenthaltsdauer`)}: <span className="font-medium text-foreground">{naechte} {naechte === 1 ? tx('Nacht') : tx('Nächte')}</span>
                </p>
              )}

              <div className="space-y-1">
                <Label htmlFor="preis">{tx('Preis (€)')}</Label>
                <Input
                  id="preis"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisEuro}
                  onChange={e => setPreisEuro(e.target.value)}
                  placeholder={tx('z. B. 35.00')}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notizen">{tx('Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Besondere Hinweise, Fütterungszeiten etc.')}
                  rows={3}
                />
              </div>
            </div>

            {aError && <p className="text-sm text-destructive">{aError}</p>}

            <div className="flex gap-2 flex-wrap">
              <Button
                disabled={!platznummerKey || !anreisedatum || !abreisedatum || naechte <= 0 || aSaving}
                onClick={handleCreateAufenthalt}
                className="flex-1 sm:flex-none"
              >
                {aSaving ? tx('Wird gespeichert …') : tx('Buchung anlegen')}
              </Button>
              <Button variant="outline" onClick={() => setStep(2)} disabled={aSaving}>
                {tx('Zurück')}
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

      {/* ── Schritt 4: Erfolg ──────────────────────────────────────────── */}
      {step === 4 && (
        successInfo ? (
          <div className="flex flex-col items-center text-center py-10 space-y-6">
            <div className="rounded-full bg-primary/10 p-5">
              <IconCheck size={40} className="text-primary" stroke={1.5} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {tx('Buchung erfolgreich angelegt!')}
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                {successInfo.hundName} {tx('ist vom')} {successInfo.anreise} {tx('bis')} {successInfo.abreise} {tx('eingeplant.')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
              <Button variant="outline" asChild>
                <a href="#/">{tx('Zurück zum Dashboard')}</a>
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
    </IntentWizardShell>
  );
}
