/**
 * Neue Buchung — 3-Schritt-Wizard zum Anlegen eines neuen Aufenthalts.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen
 *        → 3) Zeitraum, Platznummer und Details festlegen & Aufenthalt anlegen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry),
 *        hunde (createHundeEntry), aufenthalte (createAufenthalteEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { tx } from '@/i18n';
import { IconUser, IconDog, IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { differenceInDays } from 'date-fns';

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  // Wizard step (1-based)
  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showBesitzerCreate, setShowBesitzerCreate] = useState(false);
  const [besitzerVorname, setBesitzerVorname] = useState('');
  const [besitzerNachname, setBesitzerNachname] = useState('');
  const [besitzerTelefon, setBesitzerTelefon] = useState('');
  const [besitzerEmail, setBesitzerEmail] = useState('');
  const [besitzerCreating, setBesitzerCreating] = useState(false);
  const [besitzerError, setBesitzerError] = useState<string | null>(null);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showHundCreate, setShowHundCreate] = useState(false);
  const [hundName, setHundName] = useState('');
  const [hundRasse, setHundRasse] = useState('');
  const [hundGeschlecht, setHundGeschlecht] = useState('none');
  const [hundGewicht, setHundGewicht] = useState('');
  const [hundCreating, setHundCreating] = useState(false);
  const [hundError, setHundError] = useState<string | null>(null);

  // Step 3 — Aufenthalt
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummerKey, setPlatznummerKey] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [aufenthaltCreating, setAufenthaltCreating] = useState(false);
  const [aufenthaltError, setAufenthaltError] = useState<string | null>(null);
  const [createdAufenthaltId, setCreatedAufenthaltId] = useState<string | null>(null);

  // Derived values
  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);
  const hundeDesBesitzers = hunde.filter(
    h => extractRecordId(h.fields.besitzer) === selectedBesitzerId
  );

  const platznummerOptions = LOOKUP_OPTIONS['aufenthalte']?.['platznummer'] ?? [];

  const aufenthaltsDauer =
    anreisedatum && abreisedatum
      ? differenceInDays(new Date(abreisedatum), new Date(anreisedatum))
      : 0;

  // Step 1: Besitzer neu anlegen
  const handleBesitzerCreate = async () => {
    if (!besitzerVorname.trim() || !besitzerNachname.trim()) return;
    setBesitzerCreating(true);
    setBesitzerError(null);
    try {
      const created = await LivingAppsService.createBesitzerEntry({
        vorname: besitzerVorname.trim(),
        nachname: besitzerNachname.trim(),
        telefon: besitzerTelefon.trim() || undefined,
        email: besitzerEmail.trim() || undefined,
      });
      await fetchAll();
      setShowBesitzerCreate(false);
      setBesitzerVorname('');
      setBesitzerNachname('');
      setBesitzerTelefon('');
      setBesitzerEmail('');
      setSelectedBesitzerId(created.record_id);
      setSelectedHundId(null);
      setStep(2);
    } catch {
      setBesitzerError(tx('Besitzer konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setBesitzerCreating(false);
    }
  };

  // Step 2: Hund neu anlegen
  const handleHundCreate = async () => {
    if (!hundName.trim() || !selectedBesitzerId) return;
    setHundCreating(true);
    setHundError(null);
    try {
      const created = await LivingAppsService.createHundeEntry({
        name: hundName.trim(),
        rasse: hundRasse.trim() || undefined,
        geschlecht: hundGeschlecht !== 'none' ? hundGeschlecht : undefined,
        gewicht_kg: hundGewicht ? parseFloat(hundGewicht) : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowHundCreate(false);
      setHundName('');
      setHundRasse('');
      setHundGeschlecht('none');
      setHundGewicht('');
      setSelectedHundId(created.record_id);
      setStep(3);
    } catch {
      setHundError(tx('Hund konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setHundCreating(false);
    }
  };

  // Step 3: Aufenthalt anlegen (idempotent guard)
  const handleAufenthaltCreate = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreisedatum || !abreisedatum || platznummerKey === 'none') return;
    setAufenthaltCreating(true);
    setAufenthaltError(null);

    let aid = createdAufenthaltId;
    try {
      if (!aid) {
        const created = await LivingAppsService.createAufenthalteEntry({
          hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
          besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
          platznummer: platznummerKey,
          anreisedatum,
          abreisedatum,
          status: 'geplant',
          herkunft: 'direkt',
          preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
          notizen: notizen.trim() || undefined,
        });
        aid = created.record_id;
        setCreatedAufenthaltId(aid);
      }
      await fetchAll();
      setStep(4);
    } catch {
      setAufenthaltError(tx('Aufenthalt konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setAufenthaltCreating(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowBesitzerCreate(false);
    setShowHundCreate(false);
    setAnreisedatum('');
    setAbreisedatum('');
    setPlatznummerKey('none');
    setPreisEuro('');
    setNotizen('');
    setCreatedAufenthaltId(null);
    setAufenthaltError(null);
  };

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Aufenthalt in 3 Schritten anlegen')}
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
      {/* ── Schritt 1: Besitzer wählen oder neu anlegen ── */}
      {step === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={besitzer.map(b => ({
              id: b.record_id,
              title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || b.record_id,
              subtitle: b.fields.telefon ?? b.fields.email ?? undefined,
              icon: <IconUser size={20} className="text-primary" />,
            }))}
            onSelect={(id) => {
              setSelectedBesitzerId(id);
              setSelectedHundId(null);
              setStep(2);
            }}
            createLabel={tx('Neuen Besitzer anlegen')}
            onCreateNew={() => setShowBesitzerCreate(true)}
            searchPlaceholder={tx('Besitzer suchen …')}
            emptyText={tx('Noch kein Besitzer gefunden')}
            emptyIcon={<IconUser size={40} className="text-muted-foreground" />}
            createDialog={showBesitzerCreate && (
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="b-vorname">{tx('Vorname')}</Label>
                    <Input
                      id="b-vorname"
                      value={besitzerVorname}
                      onChange={e => setBesitzerVorname(e.target.value)}
                      placeholder={tx('Vorname')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-nachname">{tx('Nachname')}</Label>
                    <Input
                      id="b-nachname"
                      value={besitzerNachname}
                      onChange={e => setBesitzerNachname(e.target.value)}
                      placeholder={tx('Nachname')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-telefon">{tx('Telefon')}</Label>
                    <Input
                      id="b-telefon"
                      type="tel"
                      value={besitzerTelefon}
                      onChange={e => setBesitzerTelefon(e.target.value)}
                      placeholder={tx('Telefonnummer')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                    <Input
                      id="b-email"
                      type="email"
                      value={besitzerEmail}
                      onChange={e => setBesitzerEmail(e.target.value)}
                      placeholder={tx('E-Mail-Adresse')}
                    />
                  </div>
                </div>
                {besitzerError && (
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <IconAlertCircle size={16} className="shrink-0" />
                    {besitzerError}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!besitzerVorname.trim() || !besitzerNachname.trim() || besitzerCreating}
                    onClick={handleBesitzerCreate}
                  >
                    {besitzerCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                  </Button>
                  <Button variant="outline" onClick={() => setShowBesitzerCreate(false)}>
                    {tx('Abbrechen')}
                  </Button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* ── Schritt 2: Hund wählen oder neu anlegen ── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {selectedBesitzer
                ? tx`Besitzer: ${[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}`
                : null}
            </div>
            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.gewicht_kg ? `${h.fields.gewicht_kg} kg` : undefined]
                  .filter(Boolean)
                  .join(' · ') || undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowHundCreate(true)}
              searchPlaceholder={tx('Hund suchen …')}
              emptyText={
                hundeDesBesitzers.length === 0
                  ? tx('Noch kein Hund für diesen Besitzer — bitte neu anlegen')
                  : tx('Kein Hund gefunden')
              }
              emptyIcon={<IconDog size={40} className="text-muted-foreground" />}
              createDialog={showHundCreate && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="h-name">{tx('Name des Hundes')}</Label>
                      <Input
                        id="h-name"
                        value={hundName}
                        onChange={e => setHundName(e.target.value)}
                        placeholder={tx('Hundename')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-rasse">{tx('Rasse')}</Label>
                      <Input
                        id="h-rasse"
                        value={hundRasse}
                        onChange={e => setHundRasse(e.target.value)}
                        placeholder={tx('z. B. Golden Retriever')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-gewicht">{tx('Gewicht (kg)')}</Label>
                      <Input
                        id="h-gewicht"
                        type="number"
                        min="0"
                        step="0.1"
                        value={hundGewicht}
                        onChange={e => setHundGewicht(e.target.value)}
                        placeholder={tx('z. B. 12.5')}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={hundGeschlecht} onValueChange={setHundGeschlecht}>
                        <SelectTrigger id="h-geschlecht">
                          <SelectValue placeholder={tx('Bitte wählen …')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {(LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? []).map(opt => (
                            <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {hundError && (
                    <p className="flex items-center gap-2 text-sm text-destructive">
                      <IconAlertCircle size={16} className="shrink-0" />
                      {hundError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!hundName.trim() || hundCreating}
                      onClick={handleHundCreate}
                    >
                      {hundCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowHundCreate(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
            <div className="pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Zurück zu Schritt 1')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl eines Besitzers aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Aufenthalt anlegen ── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-5">
            {/* Kontext-Zusammenfassung */}
            <div className="rounded-2xl border bg-secondary/50 px-4 py-3 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconUser size={15} className="shrink-0" />
                <span className="font-medium text-foreground">
                  {selectedBesitzer
                    ? [selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')
                    : selectedBesitzerId}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconDog size={15} className="shrink-0" />
                <span className="font-medium text-foreground">
                  {selectedHund?.fields.name ?? selectedHundId}
                </span>
              </span>
            </div>

            {/* Datumsbereich */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="a-anreise">{tx('Anreisedatum')}</Label>
                <Input
                  id="a-anreise"
                  type="date"
                  value={anreisedatum}
                  onChange={e => {
                    setAnreisedatum(e.target.value);
                    if (abreisedatum && e.target.value > abreisedatum) {
                      setAbreisedatum('');
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="a-abreise">{tx('Abreisedatum')}</Label>
                <Input
                  id="a-abreise"
                  type="date"
                  value={abreisedatum}
                  min={anreisedatum || undefined}
                  onChange={e => setAbreisedatum(e.target.value)}
                />
              </div>
            </div>

            {/* Dauer-Hinweis */}
            {aufenthaltsDauer > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <IconCalendar size={15} className="shrink-0" />
                {tx`Aufenthaltsdauer: ${aufenthaltsDauer} ${aufenthaltsDauer === 1 ? tx('Nacht') : tx('Nächte')}`}
              </p>
            )}

            {/* Platznummer */}
            <div className="space-y-1">
              <Label htmlFor="a-platz">{tx('Platznummer')}</Label>
              <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                <SelectTrigger id="a-platz">
                  <SelectValue placeholder={tx('Platz wählen …')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tx('Bitte wählen …')}</SelectItem>
                  {platznummerOptions.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preis */}
            <div className="space-y-1">
              <Label htmlFor="a-preis">{tx('Preis (€)')}</Label>
              <Input
                id="a-preis"
                type="number"
                min="0"
                step="0.01"
                value={preisEuro}
                onChange={e => setPreisEuro(e.target.value)}
                placeholder={tx('z. B. 350.00')}
              />
            </div>

            {/* Notizen */}
            <div className="space-y-1">
              <Label htmlFor="a-notizen">{tx('Notizen')}</Label>
              <Textarea
                id="a-notizen"
                value={notizen}
                onChange={e => setNotizen(e.target.value)}
                placeholder={tx('Besondere Hinweise, Wünsche …')}
                rows={3}
              />
            </div>

            {aufenthaltError && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                {aufenthaltError}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                disabled={
                  !anreisedatum ||
                  !abreisedatum ||
                  platznummerKey === 'none' ||
                  aufenthaltsDauer <= 0 ||
                  aufenthaltCreating
                }
                onClick={handleAufenthaltCreate}
              >
                {aufenthaltCreating ? tx('Wird angelegt …') : tx('Aufenthalt anlegen')}
              </Button>
              <Button variant="outline" onClick={() => setStep(2)}>
                {tx('Zurück zu Schritt 2')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht Besitzer und Hund aus den vorherigen Schritten.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Schritt 4: Erfolg ── */}
      {step === 4 && (
        <div className="flex flex-col items-center text-center py-10 space-y-6">
          <div className="rounded-full bg-primary/10 p-4">
            <IconCheck size={40} className="text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{tx('Aufenthalt angelegt!')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {selectedBesitzer && selectedHund
                ? tx`${[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')} mit ${selectedHund.fields.name ?? tx('dem Hund')} wurde erfolgreich gebucht.`
                : tx('Der Aufenthalt wurde erfolgreich angelegt.')}
            </p>
            {anreisedatum && abreisedatum && (
              <p className="text-sm text-muted-foreground">
                {tx`${anreisedatum} bis ${abreisedatum}`}
                {platznummerKey !== 'none' && (
                  <> {tx('&middot;')} {platznummerOptions.find(o => o.key === platznummerKey)?.label ?? platznummerKey}</>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
            <a href="#/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              {tx('Zurück zum Dashboard')}
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
