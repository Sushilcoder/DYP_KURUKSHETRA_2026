import { METRIC_KEYS, type Verification } from '@/lib/course-schema';

const VERDICT = {
  LOW: { title: 'Invalid', text: 'Below 50%. This pack was rejected and regeneration was triggered.' },
  MEDIUM: { title: 'Needs review', text: '50-70%. Usable after a trainer reviews the suggested fixes below.' },
  HIGH: { title: 'Valid & accepted', text: '70-100%. Code checks passed. Ready for the classroom.' },
};

export function ScoreBreakdown({ v }: { v: Verification }) {
  const verdict = VERDICT[v.band];
  return (
    <div className="score-block">
      <div className={`verdict ${v.band.toLowerCase()}`}>
        <div className="verdict-score">
          <strong>{v.score}</strong>
          <span>%</span>
        </div>
        <div>
          <b>
            {v.band} · {verdict.title}
          </b>
          <p>{verdict.text}</p>
        </div>
      </div>

      <div className="formula">
        <code>CS = {v.formula}</code>
        <code>
          Final = {v.cs} x 100 = {v.score}%
        </code>
      </div>

      <ul className="metric-bars">
        {METRIC_KEYS.map((k) => {
          const value = v.metrics[k];
          return (
            <li key={k}>
              <div className="metric-bar-head">
                <span>
                  <b>{k}</b> {v.labels[k]}
                </span>
                <span className="metric-bar-num">
                  {(value * 100).toFixed(0)}% <small>x {v.weights[k]}</small>
                </span>
              </div>
              <div className="metric-track" aria-hidden="true">
                <div style={{ width: `${value * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
