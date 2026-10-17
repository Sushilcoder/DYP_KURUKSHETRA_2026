import type { Band } from '@/lib/course-schema';

const BAND_LABEL: Record<Band, string> = { LOW: 'Invalid', MEDIUM: 'Needs review', HIGH: 'Valid' };

export function ConfidenceBadge({ score, band, pending }: { score: number | null; band: Band | null; pending: boolean }) {
  const tone = band ? band.toLowerCase() : 'idle';
  return (
    <div className={`cs-badge ${tone}`} role="status" aria-live="polite" aria-label="Confidence score">
      <div className="cs-ring" style={{ '--score': `${score ?? 0}%` } as React.CSSProperties}>
        <span>{pending ? <span className="spinner small" /> : score !== null ? Math.round(score) : '--'}</span>
      </div>
      <div className="cs-text">
        <small>Confidence score</small>
        <b>{pending ? 'Verifying...' : band ? `${band} · ${BAND_LABEL[band]}` : 'Not scored yet'}</b>
      </div>
    </div>
  );
}
