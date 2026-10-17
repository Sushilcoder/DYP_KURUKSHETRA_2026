'use client';

import { useState } from 'react';
import type { Course } from '@/lib/course-schema';

export function SlidePreview({ course, accent }: { course: Course; accent: string }) {
  const [index, setIndex] = useState(0);
  const slide = course.slides[index];
  if (!slide) return null;

  return (
    <div className="slide-preview">
      <div className="slide-frame" style={{ '--accent': accent } as React.CSSProperties}>
        <span className="slide-num">{String(index + 1).padStart(2, '0')}</span>
        <h4>{slide.title}</h4>
        <div className={slide.code ? 'slide-body split' : 'slide-body'}>
          <ul>
            {slide.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          {slide.code && <pre>{slide.code.code}</pre>}
        </div>
      </div>
      <div className="slide-controls">
        <button type="button" className="secondary-button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          Prev
        </button>
        <span>
          {index + 1} / {course.slides.length}
        </span>
        <button type="button" className="secondary-button" onClick={() => setIndex((i) => Math.min(course.slides.length - 1, i + 1))} disabled={index === course.slides.length - 1}>
          Next
        </button>
      </div>
      <p className="slide-notes">
        <b>Speaker notes</b> {slide.notes}
      </p>
    </div>
  );
}
