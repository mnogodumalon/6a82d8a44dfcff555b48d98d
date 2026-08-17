/**
 * Pfoten-Porträt — 3-Schritt-Wizard.
 * Steps: 1) Hund auswählen → 2) Portrait generieren (KI) → 3) Speichern & Bestätigung.
 * Reads: hunde (enrichiert mit besitzerMap). Writes: hunde (updateHundeEntry — Feld medikamente_besonderheiten).
 * Composes: IntentWizardShell, EntitySelectStep, chatCompletion aus @/lib/ai.
 */
import { useState } from 'react';
import { IconPaw, IconSparkles, IconCopy, IconCheck, IconDog } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichHunde } from '@/lib/enrich';
import type { EnrichedHunde } from '@/types/enriched';
import { LivingAppsService } from '@/services/livingAppsService';
import { tx } from '@/i18n';
import { chatCompletion } from '@/lib/ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function PfotenPortraetPage() {
  const data = useDashboardData();
  const { hunde, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedHund, setSelectedHund] = useState<EnrichedHunde | null>(null);
  const [portraitText, setPortraitText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [copied, setCopied] = useState(false);

  const enrichedHunde = enrichHunde(hunde, { besitzerMap });

  const handleSelectHund = (id: string) => {
    const hund = enrichedHunde.find(h => h.record_id === id);
    if (hund) {
      setSelectedHund(hund);
      setPortraitText('');
      setGenerateError(null);
      setSavedSuccessfully(false);
      setStep(2);
    }
  };

  const handleGeneratePortrait = async () => {
    if (!selectedHund) return;
    setIsGenerating(true);
    setGenerateError(null);
    const f = selectedHund.fields;
    const prompt = [
      'Du bist ein warmherziger Texter für ein Hundehotel. Schreibe ein liebevolles, persönliches Pfoten-Porträt für den Besitzer eines Hundes.',
      'Ton: warm, fürsorglich, individuell — wie eine herzliche Postkarte vom Hundehotel. 2–3 Absätze, auf Deutsch.',
      '',
      'Daten des Hundes:',
      tx`Name: ${f.name ?? tx('Unbekannt')}`,
      f.rasse ? tx`Rasse: ${f.rasse}` : '',
      f.geschlecht?.label ? tx`Geschlecht: ${f.geschlecht.label}` : '',
      f.gewicht_kg != null ? tx`Gewicht: ${f.gewicht_kg} kg` : '',
      f.impfstatus?.label ? tx`Impfstatus: ${f.impfstatus.label}` : '',
      f.fuetterungshinweise ? tx`Fütterungshinweise: ${f.fuetterungshinweise}` : '',
      f.medikamente_besonderheiten ? tx`Besonderheiten/Medikamente: ${f.medikamente_besonderheiten}` : '',
      selectedHund.besitzerName ? tx`Besitzer: ${selectedHund.besitzerName}` : '',
    ].filter(Boolean).join('\n');

    try {
      const result = await chatCompletion([{ role: 'user', content: prompt }]);
      setPortraitText(result ?? '');
    } catch {
      setGenerateError(tx('Das Portrait konnte nicht generiert werden. Bitte versuche es erneut.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedHund || !portraitText.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    const marker = tx('--- Pfoten-Porträt ---\n');
    const existing = selectedHund.fields.medikamente_besonderheiten ?? '';
    // Strip any previous portrait block before prepending, then prepend the new one
    const withoutOldPortrait = existing.includes(marker)
      ? existing.substring(existing.indexOf(marker))
          .replace(/^--- Pfoten-Porträt ---\n[\s\S]*?(?=\n--- |$)/, '')
          .replace(/^--- Pfoten-Porträt ---\n/, '')
          .trimStart()
      : existing;
    const newText = marker + portraitText.trim() + (withoutOldPortrait ? '\n\n' + withoutOldPortrait : '');
    try {
      await LivingAppsService.updateHundeEntry(selectedHund.record_id, {
        medikamente_besonderheiten: newText,
      });
      await fetchAll();
      setSavedSuccessfully(true);
      setStep(3);
    } catch {
      setSaveError(tx('Speichern fehlgeschlagen. Bitte versuche es erneut.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!portraitText) return;
    navigator.clipboard.writeText(portraitText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setSelectedHund(null);
    setPortraitText('');
    setGenerateError(null);
    setSaveError(null);
    setSavedSuccessfully(false);
    setCopied(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt')}
      subtitle={tx('Ein liebevolles KI-Portrait für jeden Hund')}
      steps={[
        { label: tx('Hund wählen') },
        { label: tx('Portrait generieren') },
        { label: tx('Gespeichert') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1 — Hund auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={enrichedHunde.map(h => ({
            id: h.record_id,
            title: h.fields.name ?? tx('Unbekannter Hund'),
            subtitle: [h.fields.rasse, h.besitzerName ? tx`Besitzer: ${h.besitzerName}` : '']
              .filter(Boolean)
              .join(' · '),
            status: h.fields.impfstatus
              ? { key: h.fields.impfstatus.key, label: h.fields.impfstatus.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectHund}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Keine Hunde gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Schritt 2 — Portrait generieren */}
      {step === 2 && (
        selectedHund ? (
          <div className="space-y-6">
            {/* Hunddaten-Zusammenfassung */}
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <IconDog size={20} className="text-primary shrink-0" />
                <h2 className="font-semibold text-foreground">{selectedHund.fields.name}</h2>
                {selectedHund.fields.impfstatus && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {selectedHund.fields.impfstatus.label}
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {selectedHund.fields.rasse && (
                  <>
                    <dt className="text-muted-foreground">{tx('Rasse')}</dt>
                    <dd className="text-foreground">{selectedHund.fields.rasse}</dd>
                  </>
                )}
                {selectedHund.fields.geschlecht && (
                  <>
                    <dt className="text-muted-foreground">{tx('Geschlecht')}</dt>
                    <dd className="text-foreground">{selectedHund.fields.geschlecht.label}</dd>
                  </>
                )}
                {selectedHund.fields.gewicht_kg != null && (
                  <>
                    <dt className="text-muted-foreground">{tx('Gewicht')}</dt>
                    <dd className="text-foreground">{selectedHund.fields.gewicht_kg} {tx('kg')}</dd>
                  </>
                )}
                {selectedHund.besitzerName && (
                  <>
                    <dt className="text-muted-foreground">{tx('Besitzer')}</dt>
                    <dd className="text-foreground">{selectedHund.besitzerName}</dd>
                  </>
                )}
                {selectedHund.fields.fuetterungshinweise && (
                  <>
                    <dt className="text-muted-foreground col-span-2 mt-1 font-medium">{tx('Fütterungshinweise')}</dt>
                    <dd className="text-foreground col-span-2 whitespace-pre-wrap text-xs leading-relaxed">
                      {selectedHund.fields.fuetterungshinweise}
                    </dd>
                  </>
                )}
                {selectedHund.fields.medikamente_besonderheiten && (
                  <>
                    <dt className="text-muted-foreground col-span-2 mt-1 font-medium">{tx('Medikamente & Besonderheiten')}</dt>
                    <dd className="text-foreground col-span-2 whitespace-pre-wrap text-xs leading-relaxed">
                      {selectedHund.fields.medikamente_besonderheiten}
                    </dd>
                  </>
                )}
              </dl>
            </div>

            {/* KI-Generierung */}
            <div className="space-y-3">
              <Button
                onClick={handleGeneratePortrait}
                disabled={isGenerating}
                className="w-full sm:w-auto flex items-center gap-2"
              >
                <IconSparkles size={16} className="shrink-0" />
                {isGenerating ? tx('Portrait wird generiert …') : tx('Portrait generieren')}
              </Button>

              {generateError && (
                <p className="text-sm text-destructive">{generateError}</p>
              )}
            </div>

            {/* Generierter Text */}
            {portraitText && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    {tx('Generiertes Portrait')}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {tx('Du kannst den Text noch anpassen')}
                  </span>
                </div>
                <Textarea
                  value={portraitText}
                  onChange={e => setPortraitText(e.target.value)}
                  rows={10}
                  className="resize-y"
                />
                {saveError && (
                  <p className="text-sm text-destructive">{saveError}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !portraitText.trim()}
                  >
                    {isSaving ? tx('Wird gespeichert …') : tx('Portrait speichern')}
                  </Button>
                  <Button variant="outline" onClick={() => setStep(1)}>
                    {tx('Anderen Hund wählen')}
                  </Button>
                </div>
              </div>
            )}

            {/* Kein Text noch — Hinweis */}
            {!portraitText && !isGenerating && (
              <p className="text-sm text-muted-foreground">
                {tx('Klicke auf „Portrait generieren", um ein individuelles Porträt zu erstellen.')}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* Schritt 3 — Erfolgsmeldung */}
      {step === 3 && (
        savedSuccessfully && selectedHund ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 space-y-4 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <IconPaw size={36} className="text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {tx`Portrait für ${selectedHund.fields.name ?? ''} gespeichert!`}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {tx('Das Pfoten-Porträt wurde im Hundeprofil hinterlegt.')}
                </p>
              </div>
            </div>

            {/* Portrait-Text zum Kopieren */}
            <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {tx('Porträt-Text')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5"
                >
                  {copied
                    ? <><IconCheck size={14} className="shrink-0" />{tx('Kopiert!')}</>
                    : <><IconCopy size={14} className="shrink-0" />{tx('Kopieren')}</>
                  }
                </Button>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {portraitText}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleReset} variant="outline">
                {tx('Neues Portrait erstellen')}
              </Button>
              <a href="#/" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                {tx('Zurück zum Dashboard')}
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
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
