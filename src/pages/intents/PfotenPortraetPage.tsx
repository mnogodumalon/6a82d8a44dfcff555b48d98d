/**
 * Pfoten-Portraet — 2-Schritt-Wizard.
 * Steps: 1) Hund auswaehlen → 2) KI-Portraet generieren und kopieren.
 * Reads: hunde, besitzer. Writes: keine.
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { EnrichedHunde } from '@/types/enriched';
import { enrichHunde } from '@/lib/enrich';
import { formatDate } from '@/lib/formatters';
import { summarize } from '@/lib/ai';
import { tx } from '@/i18n';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IconDog, IconRefresh, IconCopy, IconCheck, IconPaw } from '@tabler/icons-react';

export default function PfotenPortraetPage() {
  const data = useDashboardData();
  const { hunde, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedHund, setSelectedHund] = useState<EnrichedHunde | null>(null);
  const [portraetText, setPortraetText] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const enrichedHunde = enrichHunde(hunde, { besitzerMap });

  const handleSelectHund = useCallback(
    async (id: string) => {
      const hund = enrichedHunde.find((h) => h.record_id === id) ?? null;
      setSelectedHund(hund);
      setPortraetText('');
      setGenerateError(null);
      setCopied(false);
      setStep(2);
      if (hund) {
        await generatePortraet(hund);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrichedHunde],
  );

  const generatePortraet = useCallback(async (hund: EnrichedHunde) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const name = hund.fields.name ?? tx('Unbekannter Hund');
      const rasse = hund.fields.rasse ?? tx('Unbekannte Rasse');
      const geburt = hund.fields.geburtsdatum
        ? formatDate(hund.fields.geburtsdatum)
        : tx('unbekannt');
      const gewicht = hund.fields.gewicht_kg != null
        ? `${hund.fields.gewicht_kg} kg`
        : tx('unbekannt');
      const geschlecht = hund.fields.geschlecht?.label ?? tx('unbekannt');
      const impf = hund.fields.impfstatus?.label ?? tx('unbekannt');
      const fuetterung = hund.fields.fuetterungshinweise ?? tx('keine besonderen Hinweise');
      const besitzer = hund.besitzerName || tx('unbekannt');

      const prompt =
        `Erstelle ein herzliches, persönliches Portraet-Text (3-4 Sätze, auf Deutsch, warm und liebevoll) ` +
        `für einen Hund mit folgenden Daten:\n` +
        tx`Name: ${name}\n` +
        tx`Rasse: ${rasse}\n` +
        tx`Geburtsdatum: ${geburt}\n` +
        tx`Gewicht: ${gewicht}\n` +
        tx`Geschlecht: ${geschlecht}\n` +
        tx`Impfstatus: ${impf}\n` +
        tx`Fütterungshinweise: ${fuetterung}\n` +
        tx`Besitzer: ${besitzer}\n` +
        `Der Text soll wie eine liebevolle Beschreibung klingen, die dem Besitzer als schöne Erinnerung dient.`;

      const result = await summarize(prompt);
      setPortraetText(result);
    } catch {
      setGenerateError(tx('Fehler beim Generieren des Portraets. Bitte erneut versuchen.'));
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleRegenerate = useCallback(() => {
    if (selectedHund) {
      setCopied(false);
      generatePortraet(selectedHund);
    }
  }, [selectedHund, generatePortraet]);

  const handleCopy = useCallback(async () => {
    if (!portraetText) return;
    await navigator.clipboard.writeText(portraetText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [portraetText]);

  const handleReset = useCallback(() => {
    setSelectedHund(null);
    setPortraetText('');
    setGenerateError(null);
    setCopied(false);
    setStep(1);
  }, []);

  const STEPS = [{ label: tx('Hund wählen') }, { label: tx('Portraet') }];

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet')}
      subtitle={tx('KI-generiertes persönliches Portraet für deinen Hund')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Hund auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={enrichedHunde
            .filter((h) => !!h.fields.name && !!h.fields.rasse && !!h.besitzerName)
            .map((h) => ({
              id: h.record_id,
              title: h.fields.name ?? '',
              subtitle: `${h.fields.rasse ?? ''} · ${tx('Besitzer')}: ${h.besitzerName}`,
              icon: <IconDog size={20} className="text-primary" />,
              stats: [
                ...(h.fields.geburtsdatum
                  ? [{ label: tx('Geburt'), value: formatDate(h.fields.geburtsdatum) }]
                  : []),
                ...(h.fields.gewicht_kg != null
                  ? [{ label: tx('Gewicht'), value: `${h.fields.gewicht_kg} kg` }]
                  : []),
                ...(h.fields.impfstatus
                  ? [{ label: tx('Impfung'), value: h.fields.impfstatus.label }]
                  : []),
              ],
            }))}
          onSelect={handleSelectHund}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Kein Hund gefunden. Bitte lege zuerst einen Hund mit Name, Rasse und Besitzer an.')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Schritt 2: Portraet generieren */}
      {step === 2 && (
        <>
          {!selectedHund ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Hund-Zusammenfassung */}
              <Card className="bg-secondary/40">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <IconDog size={28} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {selectedHund.fields.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {selectedHund.fields.rasse}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {selectedHund.fields.geburtsdatum && (
                      <>
                        <dt className="text-muted-foreground">{tx('Geburtsdatum')}</dt>
                        <dd className="text-foreground font-medium">
                          {formatDate(selectedHund.fields.geburtsdatum)}
                        </dd>
                      </>
                    )}
                    {selectedHund.fields.gewicht_kg != null && (
                      <>
                        <dt className="text-muted-foreground">{tx('Gewicht')}</dt>
                        <dd className="text-foreground font-medium">
                          {selectedHund.fields.gewicht_kg} {tx('kg')}
                        </dd>
                      </>
                    )}
                    {selectedHund.fields.geschlecht && (
                      <>
                        <dt className="text-muted-foreground">{tx('Geschlecht')}</dt>
                        <dd className="text-foreground font-medium">
                          {selectedHund.fields.geschlecht.label}
                        </dd>
                      </>
                    )}
                    {selectedHund.fields.impfstatus && (
                      <>
                        <dt className="text-muted-foreground">{tx('Impfstatus')}</dt>
                        <dd className="text-foreground font-medium">
                          {selectedHund.fields.impfstatus.label}
                        </dd>
                      </>
                    )}
                    {selectedHund.fields.fuetterungshinweise && (
                      <>
                        <dt className="text-muted-foreground">{tx('Fütterung')}</dt>
                        <dd className="text-foreground font-medium line-clamp-2">
                          {selectedHund.fields.fuetterungshinweise}
                        </dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">{tx('Besitzer')}</dt>
                    <dd className="text-foreground font-medium truncate">
                      {selectedHund.besitzerName}
                    </dd>
                  </dl>
                </CardContent>
              </Card>

              {/* Portraet-Karte */}
              <Card>
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <IconPaw size={20} className="text-primary shrink-0" />
                    <h2 className="font-semibold text-foreground">
                      {tx('Pfoten-Portraet')}
                    </h2>
                  </div>

                  {generating && (
                    <div className="flex items-center gap-3 text-muted-foreground py-6 justify-center">
                      <IconRefresh size={20} className="animate-spin shrink-0" />
                      <span className="text-sm">{tx('Portraet wird generiert …')}</span>
                    </div>
                  )}

                  {generateError && !generating && (
                    <p className="text-sm text-destructive">{generateError}</p>
                  )}

                  {!generating && !generateError && portraetText && (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {portraetText}
                    </p>
                  )}

                  {/* Aktions-Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={generating}
                      className="flex items-center gap-2"
                    >
                      <IconRefresh size={16} className="shrink-0" />
                      {tx('Neu generieren')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCopy}
                      disabled={generating || !portraetText}
                      className="flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <IconCheck size={16} className="shrink-0" />
                          {tx('Text kopiert!')}
                        </>
                      ) : (
                        <>
                          <IconCopy size={16} className="shrink-0" />
                          {tx('Kopieren')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="outline" onClick={handleReset}>
                  {tx('Neues Portraet erstellen')}
                </Button>
                <a href="#/">
                  <Button variant="ghost">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </IntentWizardShell>
  );
}
