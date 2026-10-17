'use client';

import type { FormEvent } from 'react';

export type FormState = {
  topic: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  language: 'java' | 'python';
  framework: string;
  sourceText: string;
  brand: string;
  accent: string;
};

export function CourseForm({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: FormState;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const set = <K extends keyof FormState>(key: K, v: FormState[K]) => onChange({ ...value, [key]: v });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <section className="panel input-panel" aria-labelledby="configure-heading">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">01 / CONFIGURE</div>
          <h2 id="configure-heading">Create course pack</h2>
        </div>
      </div>
      <form onSubmit={submit} className="form-stack">
        <label>
          Topic or course title
          <input value={value.topic} onChange={(e) => set('topic', e.target.value)} minLength={3} maxLength={240} required placeholder="e.g. Python list comprehensions" />
        </label>
        <div className="form-row">
          <label>
            Student level
            <select value={value.level} onChange={(e) => set('level', e.target.value as FormState['level'])}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            Duration (minutes)
            <input type="number" value={value.duration} min={15} max={480} onChange={(e) => set('duration', e.target.value)} required />
          </label>
        </div>
        <div className="form-row">
          <label>
            Code language
            <select value={value.language} onChange={(e) => set('language', e.target.value as FormState['language'])}>
              <option value="java">Java</option>
              <option value="python">Python</option>
            </select>
          </label>
          <label>
            Framework <span className="optional">optional</span>
            <input value={value.framework} onChange={(e) => set('framework', e.target.value)} maxLength={80} />
          </label>
        </div>
        <label>
          Source notes <span className="optional">optional</span>
          <textarea value={value.sourceText} onChange={(e) => set('sourceText', e.target.value)} rows={4} maxLength={20000} placeholder="Paste syllabus notes or source material..." />
        </label>
        <div className="subsection-title">Institute branding</div>
        <div className="form-row brand-row">
          <label>
            Brand name
            <input value={value.brand} onChange={(e) => set('brand', e.target.value)} maxLength={100} />
          </label>
          <label>
            Accent color
            <div className="color-input">
              <input type="color" value={value.accent} onChange={(e) => set('accent', e.target.value)} aria-label="Accent color" />
              <span>{value.accent.toUpperCase()}</span>
            </div>
          </label>
        </div>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" /> Generating &amp; verifying...
            </>
          ) : (
            <>Generate course pack</>
          )}
        </button>
        <p className="form-footnote">Packs scoring below 50% are discarded and regenerated automatically (up to 3 attempts).</p>
      </form>
    </section>
  );
}
