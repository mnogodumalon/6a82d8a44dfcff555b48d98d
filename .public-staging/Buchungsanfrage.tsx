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
  IconShield,
  IconHeart,
  IconStar,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconPhone,
  IconMail,
} from '@tabler/icons-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
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

const EMPTY_FORM: FormData = {
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              i + 1 < step
                ? 'bg-green-500 text-white'
                : i + 1 === step
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {i + 1 < step ? <IconCheck size={14} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`h-0.5 w-8 transition-all ${
                i + 1 < step ? 'bg-green-400' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(c => {
        setCfg(c);
        setPage(c?.pages['buchungsanfrage'] ?? null);
        if (!c?.pages['buchungsanfrage']) setUnavailable(true);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  function prepareOnFirstInteraction() {
    if (challengePrepared.current || !cfg || !page) return;
    challengePrepared.current = true;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`).catch(() => {});
    }
  }

  function set(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  function validateStep1(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.interessent_vorname.trim()) errs.interessent_vorname = tx('Pflichtfeld');
    if (!form.interessent_nachname.trim()) errs.interessent_nachname = tx('Pflichtfeld');
    if (!form.interessent_telefon.trim()) errs.interessent_telefon = tx('Pflichtfeld');
    if (!form.interessent_email.trim()) errs.interessent_email = tx('Pflichtfeld');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interessent_email))
      errs.interessent_email = tx('Ungültige E-Mail-Adresse');
    if (!form.hund_name.trim()) errs.hund_name = tx('Pflichtfeld');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Pflichtfeld');
    if (
      form.wunsch_anreise &&
      form.wunsch_abreise &&
      form.wunsch_abreise <= form.wunsch_anreise
    ) {
      errs.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goToStep2() {
    if (!validateStep1()) return;
    setStep(2);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function goBack() {
    setStep(1);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    if (!cfg || !page) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await createPublicRecord(cfg, page, {
        interessent_vorname: form.interessent_vorname,
        interessent_nachname: form.interessent_nachname,
        interessent_telefon: form.interessent_telefon,
        interessent_email: form.interessent_email,
        hund_name: form.hund_name,
        hund_rasse: form.hund_rasse || undefined,
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
        nachricht: form.nachricht || undefined,
        eingangsdatum: today,
      });
      setSubmitted(true);
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch {
      setSubmitError(tx('Leider ist ein Fehler aufgetreten. Bitte versuche es erneut oder ruf uns an.'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  return (
    <PublicShell fullBleed>
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none opacity-10">
          <IconPaw size={300} className="absolute -top-8 -right-12 text-amber-400 rotate-12" />
          <IconPaw size={180} className="absolute bottom-4 -left-8 text-amber-400 -rotate-12" />
        </div>
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 text-center relative">
          <div className="inline-flex items-center gap-2 bg-amber-200/60 text-amber-800 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <IconPaw size={16} />
            {tx('Ihr Zuhause auf Zeit')}
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-4 leading-tight">
            {tx('PfotePension')}
          </h1>
          <p className="text-xl md:text-2xl text-amber-700 font-medium mb-6">
            {tx('Liebevolle Betreuung für Ihren Hund — sicher, geborgen und glücklich.')}
          </p>
          <p className="text-gray-600 max-w-xl mx-auto mb-10 text-base leading-relaxed">
            {tx('Während Sie weg sind, ist Ihr Hund bei uns in besten Pfoten. Stellen Sie jetzt Ihre unverbindliche Anfrage — wir melden uns schnell!')}
          </p>
          <button
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl px-8 py-4 text-lg shadow-lg shadow-amber-200 transition-colors"
          >
            {tx('Jetzt anfragen')}
            <IconArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            {tx('Was wir bieten')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-amber-50 border border-amber-100">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <IconShield size={28} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{tx('Sicherheit')}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {tx('Umzäuntes Gelände, 24-h-Betreuung und regelmäßige Tierarzt-Kontrollen — Ihr Hund ist bei uns sicher aufgehoben.')}
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-rose-50 border border-rose-100">
              <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mb-4">
                <IconHeart size={28} className="text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{tx('Fürsorge')}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {tx('Individuelle Betreuung nach den Gewohnheiten Ihres Hundes — Fütterung, Medikamente und Zuneigung inklusive.')}
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-green-50 border border-green-100">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <IconStar size={28} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{tx('Spaß & Auslauf')}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {tx('Tägliche Spaziergänge, Spielzeiten mit anderen Hunden und jede Menge Abwechslung für einen glücklichen Aufenthalt.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Form ────────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 md:py-20" ref={formRef}>
        <div className="max-w-xl mx-auto px-6">

          {submitted ? (
            /* ── Success state ─────────────────────────────────────────────── */
            <div className="bg-white rounded-3xl shadow-xl p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <IconCheck size={32} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {tx('Anfrage eingegangen!')}
              </h2>
              <p className="text-gray-600 leading-relaxed mb-2">
                {tx('Vielen Dank, ')}
                <strong>{form.interessent_vorname}</strong>
                {tx('! Wir haben Ihre Anfrage für ')}
                <strong>{form.hund_name}</strong>
                {tx(' erhalten und melden uns so schnell wie möglich.')}
              </p>
              <p className="text-sm text-gray-400 mt-6">
                {tx('Wunschzeitraum: ')}
                {form.wunsch_anreise} – {form.wunsch_abreise}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center text-sm text-gray-500">
                <a href="tel:+49" className="inline-flex items-center gap-1.5 hover:text-amber-600 transition-colors">
                  <IconPhone size={15} className="shrink-0" />
                  {tx('Telefonisch erreichbar')}
                </a>
                <span className="hidden sm:inline">·</span>
                <a href="mailto:" className="inline-flex items-center gap-1.5 hover:text-amber-600 transition-colors">
                  <IconMail size={15} className="shrink-0" />
                  {tx('Per E-Mail schreiben')}
                </a>
              </div>
            </div>
          ) : (
            /* ── Wizard ────────────────────────────────────────────────────── */
            <div
              className="bg-white rounded-3xl shadow-xl overflow-hidden"
              onFocus={prepareOnFirstInteraction}
            >
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-8 py-6">
                <h2 className="text-xl font-bold text-white text-center">
                  {tx('Buchungsanfrage stellen')}
                </h2>
                <p className="text-amber-100 text-sm text-center mt-1">
                  {tx('Unverbindlich & kostenlos')}
                </p>
              </div>

              <div className="px-8 py-8">
                <StepIndicator step={step} total={2} />

                {step === 1 && (
                  <div className="space-y-5">
                    <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="inline-block w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">1</span>
                      {tx('Ihre Daten & Ihr Hund')}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {tx('Vorname')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.interessent_vorname}
                          onChange={e => set('interessent_vorname', e.target.value)}
                          placeholder={tx('Max')}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.interessent_vorname ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        />
                        <FieldError msg={errors.interessent_vorname} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {tx('Nachname')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.interessent_nachname}
                          onChange={e => set('interessent_nachname', e.target.value)}
                          placeholder={tx('Mustermann')}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.interessent_nachname ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        />
                        <FieldError msg={errors.interessent_nachname} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tx('Telefonnummer')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={form.interessent_telefon}
                        onChange={e => set('interessent_telefon', e.target.value)}
                        placeholder="+49 123 456789"
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.interessent_telefon ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                      />
                      <FieldError msg={errors.interessent_telefon} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tx('E-Mail-Adresse')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={form.interessent_email}
                        onChange={e => set('interessent_email', e.target.value)}
                        placeholder="max@beispiel.de"
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.interessent_email ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                      />
                      <FieldError msg={errors.interessent_email} />
                    </div>

                    <div className="border-t border-gray-100 pt-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{tx('Ihr Hund')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {tx('Name des Hundes')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.hund_name}
                            onChange={e => set('hund_name', e.target.value)}
                            placeholder={tx('Bello')}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.hund_name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                          />
                          <FieldError msg={errors.hund_name} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {tx('Rasse')}
                            <span className="text-gray-400 text-xs ml-1">{tx('(optional)')}</span>
                          </label>
                          <input
                            type="text"
                            value={form.hund_rasse}
                            onChange={e => set('hund_rasse', e.target.value)}
                            placeholder={tx('z. B. Golden Retriever')}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={goToStep2}
                      className="w-full mt-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl px-6 py-3 transition-colors shadow-md shadow-amber-100"
                    >
                      {tx('Weiter zum Wunschtermin')}
                      <IconArrowRight size={18} />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="inline-block w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">2</span>
                      {tx('Wunschzeitraum & Nachricht')}
                    </h3>

                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                      <IconPaw size={16} className="shrink-0 mt-0.5" />
                      <span>
                        {tx('Anfrage für ')}
                        <strong>{form.hund_name}</strong>
                        {form.hund_rasse ? ` (${form.hund_rasse})` : ''}
                        {tx(' — Besitzer: ')}
                        {form.interessent_vorname} {form.interessent_nachname}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {tx('Anreise')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={form.wunsch_anreise}
                          onChange={e => set('wunsch_anreise', e.target.value)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.wunsch_anreise ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        />
                        <FieldError msg={errors.wunsch_anreise} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {tx('Abreise')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={form.wunsch_abreise}
                          onChange={e => set('wunsch_abreise', e.target.value)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.wunsch_abreise ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        />
                        <FieldError msg={errors.wunsch_abreise} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tx('Nachricht / Anmerkungen')}
                        <span className="text-gray-400 text-xs ml-1">{tx('(optional)')}</span>
                      </label>
                      <textarea
                        value={form.nachricht}
                        onChange={e => set('nachricht', e.target.value)}
                        rows={4}
                        placeholder={tx('Besonderheiten Ihres Hundes, Fütterungszeiten, Medikamente oder andere Hinweise ...')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition resize-none"
                      />
                    </div>

                    {submitError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                        {submitError}
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={goBack}
                        className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        <IconArrowLeft size={16} />
                        {tx('Zurück')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-3 transition-colors shadow-md shadow-amber-100"
                      >
                        {submitting ? (
                          <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <IconCheck size={18} />
                        )}
                        {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
                      </button>
                    </div>

                    <p className="text-xs text-center text-gray-400">
                      {tx('Unverbindliche Anfrage — wir bestätigen Ihre Buchung persönlich.')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
