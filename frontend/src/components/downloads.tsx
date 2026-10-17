'use client';

import { useState } from 'react';
import type { Course, Verification } from '@/lib/course-schema';
import { downloadNotesPdf, downloadPptx, downloadReportPdf } from '@/lib/exports';

type Meta = { brand: string; accent: string; language: string; level: string; duration: number };

export function Downloads({ course, verification, meta, attempts }: { course: Course; verification: Verification; meta: Meta; attempts: number }) {
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const locked = verification.band === 'LOW';

  const run = async (key: string, fn: () => Promise<void>) => {
    setWorking(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setWorking(null);
    }
  };

  const items = [
    { key: 'pptx', icon: 'PPT', cls: 'ppt', title: 'Slide deck', sub: '.pptx · editable, with speaker notes', fn: () => downloadPptx(course, meta, verification), gated: true },
    { key: 'notes', icon: 'PDF', cls: 'pdf', title: 'Trainer notes', sub: '.pdf · notes, solutions, quiz key', fn: () => downloadNotesPdf(course, meta), gated: true },
    { key: 'report', icon: 'CS', cls: 'report', title: 'Verification report', sub: '.pdf · score, metrics, evidence', fn: () => downloadReportPdf(course, verification, meta, attempts), gated: false },
  ];

  return (
    <div>
      <div className="output-grid three">
        {items.map((it) => {
          const disabled = (it.gated && locked) || working !== null;
          return (
            <button key={it.key} type="button" className="output-card" disabled={disabled} onClick={() => run(it.key, it.fn)}>
              <span className={`file-icon ${it.cls}`}>{it.icon}</span>
              <span>
                <b>{it.title}</b>
                <small>{it.gated && locked ? 'Locked · score too low' : it.sub}</small>
              </span>
              <span className="download" aria-hidden="true">
                {working === it.key ? <span className="spinner small dark" /> : '↓'}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="inline-error">{error}</p>}
    </div>
  );
}
