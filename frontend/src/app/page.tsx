'use client';

import { useState } from 'react';
import type { Course, Execution, Verification } from '@/lib/course-schema';
import { executePython } from '@/lib/python-runner';
import { ConfidenceBadge } from '@/components/confidence-badge';
import { CourseForm, type FormState } from '@/components/course-form';
import { ScoreBreakdown } from '@/components/score-breakdown';
import { Downloads } from '@/components/downloads';
import { Evidence } from '@/components/evidence';
import { SlidePreview } from '@/components/slide-preview';

const MAX_ATTEMPTS = 3;

type Attempt = { n: number; score: number; band: Verification['band'] };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function feedbackFrom(v: Verification) {
  const items = v.snippets.flatMap((s) => s.findings.map((f) => `${s.id} (${s.source}): ${f}`));
  return [...items, ...v.suggestions].slice(0, 25).map((s) => s.slice(0, 600));
}

export default function Home() {
  const [form, setForm] = useState<FormState>({
    topic: 'Python list comprehensions',
    level: 'beginner',
    duration: '60',
    language: 'python',
    framework: '',
    sourceText: '',
    brand: 'TechSummitTrainers',
    accent: '#1D4ED8',
  });
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [course, setCourse] = useState<Course | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState('');

  async function run(initialFeedback: string[] = []) {
    setBusy(true);
    setError('');
    const history: Attempt[] = [];
    setAttempts([]);
    let feedback = initialFeedback;
    let best: { course: Course; v: Verification } | null = null;

    try {
      for (let n = 1; n <= MAX_ATTEMPTS; n++) {
        setPhase(n === 1 ? 'Generating course content...' : `Score was LOW. Regenerating (attempt ${n}/${MAX_ATTEMPTS})...`);
        const { course: c, notice: genNotice } = await post<{ course: Course; notice?: string }>('/api/generate', {
          topic: form.topic,
          level: form.level,
          duration: Number(form.duration),
          language: form.language,
          framework: form.framework,
          sourceText: form.sourceText,
          brandName: form.brand,
          feedback,
        });
        setCourse(c);
        setNotice(genNotice ?? '');
        setVerification(null);
        setVerifying(true);
        let execution: Execution | null = null;
        if (form.language === 'python') {
          setPhase('Executing every snippet and test in a sandboxed Python runtime...');
          execution = await executePython(c).catch((err) => {
            console.error('[runner] Python execution unavailable', err);
            return null;
          });
        }
        setPhase('Running static analysis and scoring...');
        const v = await post<Verification>('/api/verify', { course: c, language: form.language, topic: form.topic, execution });
        setVerifying(false);

        history.push({ n, score: v.score, band: v.band });
        setAttempts([...history]);
        if (!best || v.score > best.v.score) best = { course: c, v };
        setCourse(best.course);
        setVerification(best.v);

        if (v.band !== 'LOW') break;
        feedback = feedbackFrom(v);
      }
      setPhase('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setPhase('');
    } finally {
      setVerifying(false);
      setBusy(false);
    }
  }

  const meta = {
    brand: form.brand || 'TechSummitTrainers',
    accent: /^#[0-9a-f]{6}$/i.test(form.accent) ? form.accent : '#1D4ED8',
    language: form.language === 'java' ? 'Java' : 'Python',
    level: form.level[0].toUpperCase() + form.level.slice(1),
    duration: Number(form.duration) || 60,
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">VC</div>
          <div>
            <div className="brand-name">Verified Course Studio</div>
            <div className="brand-sub">by {meta.brand}</div>
          </div>
        </div>
        <ConfidenceBadge score={verification?.score ?? null} band={verification?.band ?? null} pending={verifying} />
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">PS5 · COURSE MATERIAL AUTOMATION</div>
          <h1>
            Turn any topic into a <span>verified course pack.</span>
          </h1>
          <p>Slides, trainer notes, exercises and a quiz, with every code snippet compiled, run and tested before you ever stand in front of a class.</p>
        </div>
        <div className="hero-card">
          <div className="hero-card-title">Score bands</div>
          <div className="band-row low"><b>0-50%</b><span>LOW · auto-regenerate</span></div>
          <div className="band-row medium"><b>50-70%</b><span>MEDIUM · review fixes</span></div>
          <div className="band-row high"><b>70-100%</b><span>HIGH · accept &amp; export</span></div>
        </div>
      </section>

      <div className="workspace">
        <CourseForm value={form} onChange={setForm} onSubmit={() => run()} busy={busy} />

        <section className="panel results-panel" aria-labelledby="workspace-heading">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">02 / VERIFY &amp; EXPORT</div>
              <h2 id="workspace-heading">Course workspace</h2>
            </div>
            {attempts.length > 0 && (
              <ol className="attempts" aria-label="Generation attempts">
                {attempts.map((a) => (
                  <li key={a.n} className={a.band.toLowerCase()}>
                    #{a.n} {a.score}%
                  </li>
                ))}
              </ol>
            )}
          </div>

          {error && (
            <div className="alert error">
              <b>Something went wrong</b>
              <span>{error}</span>
            </div>
          )}
          {phase && (
            <div className="alert info">
              <span className="spinner small dark" />
              <span>{phase}</span>
            </div>
          )}

          {!course ? (
            <div className="empty-state">
              <h3>Your generated course appears here</h3>
              <p>Configure the session and generate. Every snippet is checked, scored and summarised in a downloadable verification report.</p>
            </div>
          ) : (
            <>
              <div className="material-title">
                <div>
                  <h3>{course.title}</h3>
                  <p>{course.summary}</p>
                </div>
              </div>

              {notice && (
                <div className="alert info">
                  <b>Template mode</b>
                  <span>{notice}</span>
                </div>
              )}

              {verification && (
                <>
                  <ScoreBreakdown v={verification} />
                  {verification.evidence.length > 0 && (
                    <ul className="evidence-chips" aria-label="Verification evidence">
                      {verification.evidence.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {verification.band === 'MEDIUM' && verification.suggestions.length > 0 && (
                    <div className="warnings">
                      <b>Suggested fixes</b>
                      <ul>
                        {verification.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                      <button type="button" className="secondary-button" disabled={busy} onClick={() => run(feedbackFrom(verification))}>
                        Apply fixes &amp; regenerate
                      </button>
                    </div>
                  )}
                  {verification.band === 'LOW' && !busy && (
                    <div className="alert error">
                      <b>Still below 50% after {attempts.length} attempts</b>
                      <span>Try narrowing the topic or adding source notes, then generate again.</span>
                    </div>
                  )}
                  <div className="section-divider" />
                  <h3 className="block-title">Downloads</h3>
                  <Downloads course={course} verification={verification} meta={meta} attempts={attempts.length} />
                </>
              )}

              <div className="section-divider" />
              <h3 className="block-title">Slide preview</h3>
              <SlidePreview course={course} accent={meta.accent} />

              {verification && (
                <>
                  <div className="section-divider" />
                  <h3 className="block-title">Code evidence</h3>
                  <Evidence course={course} v={verification} />
                </>
              )}
            </>
          )}
        </section>
      </div>

      <footer>
        <span>{meta.brand} · Verified Course Material Studio</span>
        <span>Confidence = weighted CE, TC, SA, CV, SV</span>
      </footer>
    </main>
  );
}
