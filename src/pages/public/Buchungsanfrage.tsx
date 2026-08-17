import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import {
  IconPaw,
  IconUser,
  IconDog,
  IconCalendar,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconHeart,
} from '@tabler/icons-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface FormState {
  interessent_vorname: string;
  interessent_nachname: string;
  interessent_telefon: string;
  interessent_email: string;
  hund_name: string;
  hund_rasse: string;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const EMPTY: FormState = {
  interessent_vorname: '',
  interessent_nachname: '',
  interessent_telefon: '',
  interessent_email: '',
  hund_name: '',
  hund_rasse: '',
  wunsch_anreise: '',
  wunsch_abreise: '',
  nachricht: '',
};

type Step = 1 | 2 | 3;

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  const labels = [tx('Ihre Daten'), tx('Ihr Hund'), tx('Wunschtermin')];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {labels.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {done ? <IconCheck size={16} /> : stepNum}
              </div>
              <span
                className={[
                  'mt-1 text-xs font-medium whitespace-nowrap',
                  active ? 'text-primary' : 'text-muted-foreground',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={[
                  'h-0.5 w-12 mx-1 mb-5 transition-colors',
                  done ? 'bg-primary' : 'bg-border',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Field helpers ──────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors';

// ── Step 1: Contact ────────────────────────────────────────────────────────

function Step1({
  form,
  onChange,
  onNext,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onNext: () => void;
}) {
  const valid =
    form.interessent_vorname.trim() &&
    form.interessent_nachname.trim() &&
    form.interessent_telefon.trim() &&
    form.interessent_email.trim();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <IconUser size={18} className="shrink-0" />
        <p className="text-sm">{tx('Wie können wir Sie erreichen?')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={tx('Vorname')} required>
          <input
            className={inputCls}
            type="text"
            value={form.interessent_vorname}
            onChange={e => onChange({ interessent_vorname: e.target.value })}
            placeholder={tx('z. B. Maria')}
            autoComplete="given-name"
          />
        </Field>
        <Field label={tx('Nachname')} required>
          <input
            className={inputCls}
            type="text"
            value={form.interessent_nachname}
            onChange={e => onChange({ interessent_nachname: e.target.value })}
            placeholder={tx('z. B. Müller')}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field label={tx('Telefonnummer')} required hint={tx('Wir rufen Sie zur Terminabsprache an.')}>
        <input
          className={inputCls}
          type="tel"
          value={form.interessent_telefon}
          onChange={e => onChange({ interessent_telefon: e.target.value })}
          placeholder={tx('z. B. 0151 23456789')}
          autoComplete="tel"
        />
      </Field>

      <Field label={tx('E-Mail-Adresse')} required hint={tx('Für die Bestätigung Ihrer Anfrage.')}>
        <input
          className={inputCls}
          type="email"
          value={form.interessent_email}
          onChange={e => onChange({ interessent_email: e.target.value })}
          placeholder={tx('z. B. maria@beispiel.de')}
          autoComplete="email"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!valid}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {tx('Weiter')}
          <IconArrowRight size={16} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Dog info ───────────────────────────────────────────────────────

function Step2({
  form,
  onChange,
  onBack,
  onNext,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const valid = form.hund_name.trim();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <IconDog size={18} className="shrink-0" />
        <p className="text-sm">{tx('Erzählen Sie uns von Ihrem Hund.')}</p>
      </div>

      <Field label={tx('Name des Hundes')} required>
        <input
          className={inputCls}
          type="text"
          value={form.hund_name}
          onChange={e => onChange({ hund_name: e.target.value })}
          placeholder={tx('z. B. Bello')}
        />
      </Field>

      <Field label={tx('Rasse')} hint={tx('Freitext — kein Pflichtfeld.')}>
        <input
          className={inputCls}
          type="text"
          value={form.hund_rasse}
          onChange={e => onChange({ hund_rasse: e.target.value })}
          placeholder={tx('z. B. Labrador Retriever')}
        />
      </Field>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <IconArrowLeft size={16} className="shrink-0" />
          {tx('Zurück')}
        </button>
        <button
          onClick={onNext}
          disabled={!valid}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {tx('Weiter')}
          <IconArrowRight size={16} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Dates + message ────────────────────────────────────────────────

function Step3({
  form,
  onChange,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const valid = form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise >= form.wunsch_anreise;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <IconCalendar size={18} className="shrink-0" />
        <p className="text-sm">{tx('Wann soll Ihr Hund bei uns zu Gast sein?')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={tx('Gewünschtes Anreisedatum')} required>
          <input
            className={inputCls}
            type="date"
            value={form.wunsch_anreise}
            onChange={e => onChange({ wunsch_anreise: e.target.value })}
            min={format(new Date(), 'yyyy-MM-dd')}
          />
        </Field>
        <Field label={tx('Gewünschtes Abreisedatum')} required>
          <input
            className={inputCls}
            type="date"
            value={form.wunsch_abreise}
            onChange={e => onChange({ wunsch_abreise: e.target.value })}
            min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
          />
        </Field>
      </div>

      {form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise < form.wunsch_anreise && (
        <p className="text-xs text-destructive">{tx('Das Abreisedatum muss nach dem Anreisedatum liegen.')}</p>
      )}

      <Field label={tx('Nachricht / Anmerkungen')} hint={tx('Optional — z. B. Besonderheiten, Fragen oder Wünsche.')}>
        <textarea
          className={[inputCls, 'resize-none h-28'].join(' ')}
          value={form.nachricht}
          onChange={e => onChange({ nachricht: e.target.value })}
          placeholder={tx('Haben Sie besondere Wünsche oder Hinweise zu Ihrem Hund?')}
        />
      </Field>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
        >
          <IconArrowLeft size={16} className="shrink-0" />
          {tx('Zurück')}
        </button>
        <button
          onClick={onSubmit}
          disabled={!valid || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin shrink-0" />
              {tx('Wird gesendet …')}
            </>
          ) : (
            <>
              {tx('Anfrage absenden')}
              <IconCheck size={16} className="shrink-0" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Success screen ─────────────────────────────────────────────────────────

function SuccessScreen({ vorname }: { vorname: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-8">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <IconPaw size={32} className="text-primary" stroke={1.5} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {tx('Anfrage erhalten — wir melden uns in Kürze')}
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          {tx('Vielen Dank')}{', '}{vorname}{'! '}{tx('Wir haben Ihre Buchungsanfrage erhalten und werden uns so schnell wie möglich bei Ihnen melden.')}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-4 py-3">
        <IconHeart size={14} className="shrink-0 text-primary" />
        <span>{tx('Ihr Hund freut sich bestimmt schon auf seinen Urlaub bei uns!')}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(c => {
        setCfg(c);
        setPage(c?.pages['buchungsanfrage'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const onChange = (patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
    // Warm up the challenge on first interaction
    if (!challengePrepared.current && cfg && page) {
      const ep = page.endpoints?.find(e => e.op === 'create');
      if (ep?.app_id) {
        prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
        challengePrepared.current = true;
      }
    }
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  const goNext = () => {
    setStep(s => (s < 3 ? ((s + 1) as Step) : s));
    scrollTop();
  };

  const goBack = () => {
    setStep(s => (s > 1 ? ((s - 1) as Step) : s));
    scrollTop();
  };

  const handleSubmit = async () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, string> = {
        interessent_vorname: form.interessent_vorname.trim(),
        interessent_nachname: form.interessent_nachname.trim(),
        interessent_telefon: form.interessent_telefon.trim(),
        interessent_email: form.interessent_email.trim(),
        hund_name: form.hund_name.trim(),
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
      };
      if (form.hund_rasse.trim()) payload.hund_rasse = form.hund_rasse.trim();
      if (form.nachricht.trim()) payload.nachricht = form.nachricht.trim();

      await createPublicRecord(cfg, page, payload);
      setSuccess(true);
      scrollTop();
    } catch {
      setSubmitError(tx('Die Anfrage konnte leider nicht gesendet werden. Bitte versuche es erneut oder ruf uns direkt an.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={unavailable || (!loading && !page)} />;
  }

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Senden Sie uns eine unverbindliche Anfrage — wir melden uns innerhalb von 24 Stunden.')}
    >
      <div ref={topRef} />

      {success ? (
        <SuccessScreen vorname={form.interessent_vorname} />
      ) : (
        <div className="flex flex-col">
          <StepIndicator current={step} total={3} />

          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            {step === 1 && (
              <Step1 form={form} onChange={onChange} onNext={goNext} />
            )}
            {step === 2 && (
              <Step2 form={form} onChange={onChange} onBack={goBack} onNext={goNext} />
            )}
            {step === 3 && (
              <Step3
                form={form}
                onChange={onChange}
                onBack={goBack}
                onSubmit={handleSubmit}
                submitting={submitting}
                error={submitError}
              />
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {tx('Ihre Daten werden vertraulich behandelt und nur zur Bearbeitung Ihrer Anfrage verwendet.')}
          </p>
        </div>
      )}
    </PublicShell>
  );
}
