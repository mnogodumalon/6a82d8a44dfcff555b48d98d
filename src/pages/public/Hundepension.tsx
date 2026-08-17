import { useEffect, useRef, useState } from 'react';
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
import { format } from 'date-fns';
import {
  IconPaw,
  IconHeart,
  IconShieldCheck,
  IconUsers,
  IconBone,
  IconDroplet,
  IconRun,
  IconStethoscope,
  IconCircleCheck,
  IconLoader2,
} from '@tabler/icons-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

const EMPTY_FORM: FormState = {
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

// ─── Step helpers ─────────────────────────────────────────────────────────────

// ─── Main component ───────────────────────────────────────────────────────────

export default function Hundepension() {
  const STEPS = [
  tx('Kontaktdaten'),
  tx('Hundeinfo'),
  tx('Zeitraum'),
  tx('Absenden'),
] as const;

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // form state
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState(0); // 0-3
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(c => {
        setCfg(c);
        setPage(c?.pages['hundepension'] ?? null);
        setLoading(false);
        if (!c?.pages['hundepension']) setUnavailable(true);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page) return <PublicShell unavailable />;

  // ── endpoint ──
  const ep = page.endpoints!.find(e => e.op === 'create');

  function prepareOnce() {
    if (challengePrepared.current || !ep) return;
    challengePrepared.current = true;
    prepareChallenge(cfg!, page!, 'POST', `/apps/${ep.app_id}/records`);
  }

  // ── field setter ──
  function set(field: keyof FormState, value: string) {
    prepareOnce();
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  // ── validation per step ──
  function validateStep(s: number): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (s === 0) {
      if (!form.interessent_vorname.trim()) errs.interessent_vorname = tx('Pflichtfeld');
      if (!form.interessent_nachname.trim()) errs.interessent_nachname = tx('Pflichtfeld');
      if (!form.interessent_telefon.trim()) errs.interessent_telefon = tx('Pflichtfeld');
      if (!form.interessent_email.trim()) {
        errs.interessent_email = tx('Pflichtfeld');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interessent_email)) {
        errs.interessent_email = tx('Ungültige E-Mail-Adresse');
      }
    }
    if (s === 1) {
      if (!form.hund_name.trim()) errs.hund_name = tx('Pflichtfeld');
    }
    if (s === 2) {
      if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Pflichtfeld');
      if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Pflichtfeld');
      if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise) {
        errs.wunsch_abreise = tx('Abreise muss nach Anreise liegen');
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep(s => s + 1);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function goBack() {
    setStep(s => s - 1);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  async function handleSubmit() {
    if (!validateStep(2)) { setStep(2); return; }
    if (!ep) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await createPublicRecord(cfg!, page!, {
        interessent_vorname: form.interessent_vorname.trim(),
        interessent_nachname: form.interessent_nachname.trim(),
        interessent_telefon: form.interessent_telefon.trim(),
        interessent_email: form.interessent_email.trim(),
        hund_name: form.hund_name.trim(),
        hund_rasse: form.hund_rasse.trim() || null,
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
        nachricht: form.nachricht.trim() || null,
        status: 'offen',
        eingangsdatum: today,
      });
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Leider ist ein Fehler aufgetreten. Bitte versuche es erneut oder ruf uns an.'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Shared input classes ──
  const inputCls = 'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition';
  const labelCls = 'block text-sm font-medium mb-1';
  const errCls = 'text-xs text-destructive mt-1';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <PublicShell fullBleed>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600">
              <IconPaw size={36} stroke={1.5} />
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 leading-tight">
            {tx('Herzlich willkommen in unserer Hundepension')}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            {tx('Ihr Vierbeiner ist bei uns in liebevollen Händen — wir kümmern uns so, als wäre er unser eigener.')}
          </p>
          {/* Trust signals */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2 shadow-sm text-sm font-medium">
              <IconUsers size={16} className="text-amber-500 shrink-0" />
              {tx('12 Plätze')}
            </div>
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2 shadow-sm text-sm font-medium">
              <IconHeart size={16} className="text-rose-400 shrink-0" />
              {tx('Individuelle Betreuung')}
            </div>
            <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-2 shadow-sm text-sm font-medium">
              <IconShieldCheck size={16} className="text-emerald-500 shrink-0" />
              {tx('Sicher & geborgen')}
            </div>
          </div>
          <div className="mt-8">
            <a
              href="#anfrage"
              className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full px-8 py-3 transition-colors shadow-sm"
            >
              {tx('Jetzt Anfrage stellen')}
            </a>
          </div>
        </div>
      </section>

      {/* ── LEISTUNGEN ───────────────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">{tx('Unser Angebot')}</h2>
          <p className="text-center text-muted-foreground mb-10">
            {tx('Was wir für deinen Hund tun')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <IconBone size={28} stroke={1.5} className="text-amber-500" />, title: tx('Fütterung'), desc: tx('Artgerechte Ernährung nach Ihren Vorgaben — zweimal täglich.') },
              { icon: <IconDroplet size={28} stroke={1.5} className="text-sky-400" />, title: tx('Pflege'), desc: tx('Bürsten, Pfoten pflegen und Fell in Schuss halten.') },
              { icon: <IconRun size={28} stroke={1.5} className="text-emerald-500" />, title: tx('Auslauf'), desc: tx('Mehrmals täglich Spaziergänge und Freilauf im gesicherten Bereich.') },
              { icon: <IconStethoscope size={28} stroke={1.5} className="text-rose-400" />, title: tx('Notfallbetreuung'), desc: tx('Tierarzt-Kontakt vor Ort und 24 h Rufbereitschaft im Notfall.') },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center p-5 rounded-2xl border bg-card shadow-sm">
                <div className="mb-3">{item.icon}</div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ÜBER UNS ─────────────────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-amber-50/60">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">{tx('Über uns')}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {tx('Wir sind ein kleines Team leidenschaftlicher Hundeliebhaber und betreiben unsere Pension mit Herz und Erfahrung. Jeder Hund bekommt seinen eigenen Platz, regelmäßige Aufmerksamkeit und ein ruhiges, sicheres Umfeld — ganz wie zu Hause.')}
          </p>
        </div>
      </section>

      {/* ── BUCHUNGSANFRAGE ──────────────────────────────────────────────────── */}
      <section id="anfrage" className="py-14 px-4 bg-background" ref={formRef}>
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">{tx('Buchungsanfrage')}</h2>
          <p className="text-center text-muted-foreground mb-8">
            {tx('Füll das Formular aus — wir melden uns schnellstmöglich bei dir.')}
          </p>

          {/* Step indicator */}
          {!submitted && (
            <div className="flex items-center justify-between mb-8 px-1">
              {STEPS.map((label, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i < step ? 'bg-amber-500 text-white' :
                    i === step ? 'bg-amber-500 text-white ring-2 ring-amber-300' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {i < step ? <IconCircleCheck size={16} /> : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:block ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
                  {i < STEPS.length - 1 && (
                    <div className={`absolute hidden`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {submitted ? (
            /* ── Erfolgsmeldung ── */
            <div className="rounded-2xl border bg-card shadow-sm p-8 text-center">
              <div className="flex justify-center mb-4">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600">
                  <IconCircleCheck size={32} stroke={1.5} />
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{tx('Anfrage eingegangen!')}</h3>
              <p className="text-muted-foreground">
                {tx('Ihre Anfrage ist bei uns eingegangen — wir melden uns bald!')}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-sm p-6 sm:p-8">

              {/* ── Step 0: Kontaktdaten ── */}
              {step === 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-base mb-2">{tx('Ihre Kontaktdaten')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>{tx('Vorname')} <span className="text-destructive">*</span></label>
                      <input
                        type="text"
                        className={inputCls}
                        value={form.interessent_vorname}
                        onChange={e => set('interessent_vorname', e.target.value)}
                        autoComplete="given-name"
                      />
                      {errors.interessent_vorname && <p className={errCls}>{errors.interessent_vorname}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>{tx('Nachname')} <span className="text-destructive">*</span></label>
                      <input
                        type="text"
                        className={inputCls}
                        value={form.interessent_nachname}
                        onChange={e => set('interessent_nachname', e.target.value)}
                        autoComplete="family-name"
                      />
                      {errors.interessent_nachname && <p className={errCls}>{errors.interessent_nachname}</p>}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{tx('Telefonnummer')} <span className="text-destructive">*</span></label>
                    <input
                      type="tel"
                      className={inputCls}
                      value={form.interessent_telefon}
                      onChange={e => set('interessent_telefon', e.target.value)}
                      autoComplete="tel"
                    />
                    {errors.interessent_telefon && <p className={errCls}>{errors.interessent_telefon}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>{tx('E-Mail-Adresse')} <span className="text-destructive">*</span></label>
                    <input
                      type="email"
                      className={inputCls}
                      value={form.interessent_email}
                      onChange={e => set('interessent_email', e.target.value)}
                      autoComplete="email"
                    />
                    {errors.interessent_email && <p className={errCls}>{errors.interessent_email}</p>}
                  </div>
                </div>
              )}

              {/* ── Step 1: Hundeinfo ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-base mb-2">{tx('Angaben zum Hund')}</h3>
                  <div>
                    <label className={labelCls}>{tx('Name des Hundes')} <span className="text-destructive">*</span></label>
                    <input
                      type="text"
                      className={inputCls}
                      value={form.hund_name}
                      onChange={e => set('hund_name', e.target.value)}
                    />
                    {errors.hund_name && <p className={errCls}>{errors.hund_name}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>{tx('Rasse')}</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={form.hund_rasse}
                      onChange={e => set('hund_rasse', e.target.value)}
                      placeholder={tx('z. B. Labrador, Mischlingsrasse …')} /* i18n-exempt */
                    />
                  </div>
                </div>
              )}

              {/* ── Step 2: Zeitraum ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-base mb-2">{tx('Gewünschter Zeitraum')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>{tx('Anreisedatum')} <span className="text-destructive">*</span></label>
                      <input
                        type="date"
                        className={inputCls}
                        value={form.wunsch_anreise}
                        onChange={e => set('wunsch_anreise', e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                      {errors.wunsch_anreise && <p className={errCls}>{errors.wunsch_anreise}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>{tx('Abreisedatum')} <span className="text-destructive">*</span></label>
                      <input
                        type="date"
                        className={inputCls}
                        value={form.wunsch_abreise}
                        onChange={e => set('wunsch_abreise', e.target.value)}
                        min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
                      />
                      {errors.wunsch_abreise && <p className={errCls}>{errors.wunsch_abreise}</p>}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{tx('Nachricht / Anmerkungen')}</label>
                    <textarea
                      className={`${inputCls} min-h-[90px] resize-y`}
                      value={form.nachricht}
                      onChange={e => set('nachricht', e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 3: Übersicht & Absenden ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-base mb-3">{tx('Zusammenfassung')}</h3>
                  <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{tx('Name')}</span>
                      <span className="font-medium text-right">{form.interessent_vorname} {form.interessent_nachname}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{tx('Telefon')}</span>
                      <span className="font-medium text-right">{form.interessent_telefon}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{tx('E-Mail')}</span>
                      <span className="font-medium text-right truncate max-w-[60%]">{form.interessent_email}</span>
                    </div>
                    <hr className="border-border/60" />
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{tx('Hund')}</span>
                      <span className="font-medium text-right">{form.hund_name}{form.hund_rasse ? ` (${form.hund_rasse})` : ''}</span>
                    </div>
                    <hr className="border-border/60" />
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{tx('Anreise')}</span>
                      <span className="font-medium">{form.wunsch_anreise}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{tx('Abreise')}</span>
                      <span className="font-medium">{form.wunsch_abreise}</span>
                    </div>
                    {form.nachricht && (
                      <>
                        <hr className="border-border/60" />
                        <div>
                          <span className="text-muted-foreground">{tx('Nachricht')}</span>
                          <p className="mt-1 whitespace-pre-line">{form.nachricht}</p>
                        </div>
                      </>
                    )}
                  </div>
                  {submitError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{submitError}</p>
                  )}
                </div>
              )}

              {/* ── Navigation ── */}
              <div className="flex justify-between gap-3 mt-6 pt-4 border-t">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    {tx('Zurück')}
                  </button>
                ) : <div />}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                  >
                    {tx('Weiter')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                  >
                    {submitting && <IconLoader2 size={16} className="animate-spin shrink-0" />}
                    {tx('Anfrage absenden')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER INFO ──────────────────────────────────────────────────────── */}
      <section className="py-10 px-4 bg-amber-50/60 text-center text-sm text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">{tx('Haben Sie Fragen?')}</p>
        <p>{tx('Wir freuen uns auf Ihre Nachricht über das Formular oder per Telefon.')}</p>
      </section>

    </PublicShell>
  );
}
