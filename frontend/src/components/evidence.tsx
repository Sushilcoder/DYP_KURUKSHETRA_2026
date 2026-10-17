import type { Course, Verification } from '@/lib/course-schema';

export function Evidence({ course, v }: { course: Course; v: Verification }) {
  const codeFor = (id: string) => {
    const n = Number(id.split('-')[1]) - 1;
    if (id.startsWith('SLIDE')) return course.slides[n]?.code?.code ?? '';
    return course.exercises[n]?.solution ?? '';
  };

  return (
    <div className="snippet-list">
      {v.snippets.map((s) => {
        const pass = s.compiles && s.staticValid && s.outputMatches;
        const ex = v.exercises.find((e) => e.id === s.id);
        return (
          <details className="snippet-item" key={s.id}>
            <summary>
              <span className="code-file-icon">{'</>'}</span>
              <span className="snippet-main">
                <b>{s.source}</b>
                <small>
                  {s.id} · {s.kind}
                  {ex ? ` · ${ex.testsPassed}/${ex.testsTotal} tests` : ''}
                </small>
              </span>
              <span className={pass ? 'pill good' : s.compiles ? 'pill warn' : 'pill bad'}>{pass ? 'PASSED' : s.compiles ? 'PARTIAL' : 'FAILED'}</span>
            </summary>
            <div className="snippet-detail">
              <pre className="log">{codeFor(s.id)}</pre>
              <div className="check-row">
                <span className={s.compiles ? 'ok' : 'no'}>Compiles</span>
                <span className={s.staticValid ? 'ok' : 'no'}>Valid syntax</span>
                <span className={s.outputMatches ? 'ok' : 'no'}>{s.kind === 'slide' ? 'Output matches' : 'Tests pass'}</span>
                <span>Analysis {(s.analysis * 100).toFixed(0)}%</span>
              </div>
              {s.findings.length > 0 && (
                <ul className="findings">
                  {s.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
