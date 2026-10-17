import type { Course, Verification } from './course-schema';

type Meta = { brand: string; accent: string; language: string; level: string; duration: number };

const INK = '1A2230';
const MUTED = '5F6B7C';
const PAPER = 'F7F8FA';

function fileSafe(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'course';
}

function hex(accent: string) {
  return accent.replace('#', '').toUpperCase();
}

function rgb(accent: string): [number, number, number] {
  const h = hex(accent);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export async function downloadPptx(course: Course, meta: Meta, verification: Verification | null) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = course.title;
  pptx.company = meta.brand;
  const accent = hex(meta.accent);

  const cover = pptx.addSlide();
  cover.background = { color: INK };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: accent } });
  cover.addText(meta.brand.toUpperCase(), { x: 0.8, y: 0.7, w: 11, h: 0.4, fontSize: 14, color: accent, bold: true, charSpacing: 4, fontFace: 'Calibri' });
  cover.addText(course.title, { x: 0.8, y: 2.1, w: 11.5, h: 1.8, fontSize: 40, color: 'FFFFFF', bold: true, fontFace: 'Calibri', valign: 'top' });
  cover.addText(course.summary, { x: 0.8, y: 4.1, w: 10.5, h: 1.2, fontSize: 16, color: 'C9D1DC', fontFace: 'Calibri', valign: 'top' });
  cover.addText(`${meta.level} · ${meta.duration} min · ${meta.language}${verification ? ` · Confidence ${verification.score}% (${verification.band})` : ''}`, {
    x: 0.8, y: 6.4, w: 11, h: 0.4, fontSize: 12, color: '8C97A8', fontFace: 'Calibri',
  });
  cover.addNotes(`Welcome learners. Objectives:\n${course.learningObjectives.map((o) => `- ${o}`).join('\n')}`);

  const objectives = pptx.addSlide();
  objectives.background = { color: PAPER };
  objectives.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: accent } });
  objectives.addText('Learning objectives', { x: 0.7, y: 0.5, w: 12, h: 0.8, fontSize: 30, bold: true, color: INK, fontFace: 'Calibri' });
  objectives.addText(
    course.learningObjectives.map((o) => ({ text: o, options: { bullet: { code: '25A0' }, paraSpaceAfter: 10 } })),
    { x: 0.8, y: 1.6, w: 11.5, h: 5, fontSize: 20, color: INK, fontFace: 'Calibri', valign: 'top' },
  );

  course.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: accent } });
    slide.addText(`${String(i + 1).padStart(2, '0')}`, { x: 0.7, y: 0.45, w: 1, h: 0.4, fontSize: 12, color: accent, bold: true, fontFace: 'Consolas' });
    slide.addText(s.title, { x: 0.7, y: 0.8, w: 12, h: 0.8, fontSize: 28, bold: true, color: INK, fontFace: 'Calibri' });
    const hasCode = Boolean(s.code?.code);
    slide.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: true, paraSpaceAfter: 8 } })),
      { x: 0.7, y: 1.8, w: hasCode ? 5.4 : 11.8, h: 4.8, fontSize: hasCode ? 16 : 20, color: INK, fontFace: 'Calibri', valign: 'top' },
    );
    if (hasCode && s.code) {
      slide.addShape(pptx.ShapeType.roundRect, { x: 6.4, y: 1.8, w: 6.3, h: 4.6, fill: { color: INK }, rectRadius: 0.08 });
      slide.addText(s.code.code, { x: 6.6, y: 1.95, w: 5.9, h: 3.6, fontSize: 11, color: 'E6EDF3', fontFace: 'Consolas', valign: 'top' });
      slide.addText(`Output: ${s.code.expectedOutput}`, { x: 6.6, y: 5.65, w: 5.9, h: 0.6, fontSize: 10, color: '9FB0C3', fontFace: 'Consolas', valign: 'top' });
    }
    slide.addText(meta.brand, { x: 0.7, y: 6.9, w: 6, h: 0.3, fontSize: 10, color: MUTED, fontFace: 'Calibri' });
    slide.addNotes(s.notes);
  });

  course.exercises.forEach((e, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: PAPER };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: accent } });
    slide.addText(`EXERCISE ${i + 1}`, { x: 0.7, y: 0.45, w: 4, h: 0.4, fontSize: 12, color: accent, bold: true, fontFace: 'Calibri', charSpacing: 3 });
    slide.addText(e.title, { x: 0.7, y: 0.8, w: 12, h: 0.8, fontSize: 28, bold: true, color: INK, fontFace: 'Calibri' });
    slide.addText(e.prompt, { x: 0.7, y: 1.8, w: 11.8, h: 2, fontSize: 18, color: INK, fontFace: 'Calibri', valign: 'top' });
    slide.addText(
      e.tests.map((t) => ({ text: `${t.input}  →  ${t.expectedOutput}`, options: { bullet: true, paraSpaceAfter: 6 } })),
      { x: 0.7, y: 4, w: 11.8, h: 2.6, fontSize: 14, color: MUTED, fontFace: 'Consolas', valign: 'top' },
    );
    slide.addNotes(`Reference solution:\n${e.solution}`);
  });

  const quiz = pptx.addSlide();
  quiz.background = { color: 'FFFFFF' };
  quiz.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: accent } });
  quiz.addText('Knowledge check', { x: 0.7, y: 0.5, w: 12, h: 0.8, fontSize: 30, bold: true, color: INK, fontFace: 'Calibri' });
  quiz.addText(
    course.quiz.map((q, i) => ({ text: `${i + 1}. ${q.question}`, options: { breakLine: true, paraSpaceAfter: 10 } })),
    { x: 0.8, y: 1.5, w: 11.8, h: 5.4, fontSize: 16, color: INK, fontFace: 'Calibri', valign: 'top' },
  );
  quiz.addNotes(course.quiz.map((q, i) => `${i + 1}. ${q.options[q.correctIndex] ?? ''} - ${q.explanation}`).join('\n'));

  const cheat = pptx.addSlide();
  cheat.background = { color: INK };
  cheat.addText('Cheat sheet', { x: 0.7, y: 0.5, w: 12, h: 0.8, fontSize: 30, bold: true, color: 'FFFFFF', fontFace: 'Calibri' });
  cheat.addText(
    course.cheatSheet.map((c) => ({ text: c, options: { bullet: { code: '25B8' }, paraSpaceAfter: 8 } })),
    { x: 0.8, y: 1.5, w: 11.8, h: 5.4, fontSize: 16, color: 'E6EDF3', fontFace: 'Calibri', valign: 'top' },
  );

  await pptx.writeFile({ fileName: `${fileSafe(course.title)}.pptx` });
}

async function newPdf() {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ unit: 'pt', format: 'a4' });
}

type Pdf = Awaited<ReturnType<typeof newPdf>>;

function writer(doc: Pdf, accent: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  let y = M;
  const [r, g, b] = rgb(accent);

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      doc.setFillColor(r, g, b);
      doc.rect(0, 0, W, 4, 'F');
      y = M;
    }
  };

  return {
    W, M,
    get y() { return y; },
    set y(v: number) { y = v; },
    ensure,
    heading(text: string, size = 16) {
      ensure(size + 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(26, 34, 48);
      const lines = doc.splitTextToSize(text, W - 2 * M);
      doc.text(lines, M, y + size);
      y += lines.length * size * 1.25 + 8;
    },
    kicker(text: string) {
      ensure(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(r, g, b);
      doc.text(text.toUpperCase(), M, y + 9);
      y += 16;
    },
    para(text: string, opts: { size?: number; color?: [number, number, number]; indent?: number } = {}) {
      const size = opts.size ?? 10.5;
      const indent = opts.indent ?? 0;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...(opts.color ?? [60, 70, 85]));
      const lines: string[] = doc.splitTextToSize(text, W - 2 * M - indent);
      for (const line of lines) {
        ensure(size * 1.5);
        doc.text(line, M + indent, y + size);
        y += size * 1.5;
      }
      y += 4;
    },
    bullet(text: string) {
      doc.setFillColor(r, g, b);
      ensure(16);
      doc.circle(M + 3, y + 7, 1.8, 'F');
      this.para(text, { indent: 14 });
    },
    code(text: string) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      const lines: string[] = text.split('\n').flatMap((l) => doc.splitTextToSize(l || ' ', W - 2 * M - 20));
      const h = lines.length * 12 + 16;
      ensure(Math.min(h, 400));
      doc.setFillColor(243, 245, 248);
      doc.roundedRect(M, y, W - 2 * M, Math.min(h, H - M - y), 4, 4, 'F');
      doc.setTextColor(30, 40, 55);
      let cy = y + 18;
      for (const line of lines) {
        if (cy > H - M) {
          doc.addPage();
          cy = M + 12;
          y = M;
        }
        doc.text(line, M + 10, cy);
        cy += 12;
      }
      y = cy + 6;
    },
    rule() {
      ensure(14);
      doc.setDrawColor(225, 229, 235);
      doc.line(M, y + 4, W - M, y + 4);
      y += 14;
    },
  };
}

function cover(doc: Pdf, title: string, subtitle: string, meta: Meta, label: string) {
  const W = doc.internal.pageSize.getWidth();
  const [r, g, b] = rgb(meta.accent);
  doc.setFillColor(26, 34, 48);
  doc.rect(0, 0, W, 190, 'F');
  doc.setFillColor(r, g, b);
  doc.rect(0, 190, W, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(r, g, b);
  doc.text(`${meta.brand.toUpperCase()} · ${label}`, 56, 60);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(doc.splitTextToSize(title, W - 112), 56, 96);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(185, 195, 208);
  doc.text(doc.splitTextToSize(subtitle, W - 112), 56, 160);
}

function footer(doc: Pdf, meta: Meta) {
  const pages = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 165);
    doc.text(meta.brand, 56, H - 28);
    doc.text(`${p} / ${pages}`, W - 56, H - 28, { align: 'right' });
  }
}

export async function downloadNotesPdf(course: Course, meta: Meta) {
  const doc = await newPdf();
  cover(doc, course.title, `${meta.level} · ${meta.duration} minutes · ${meta.language}`, meta, 'Trainer notes');
  const w = writer(doc, meta.accent);
  w.y = 226;
  w.kicker('Summary');
  w.para(course.summary, { size: 11 });
  w.kicker('Learning objectives');
  course.learningObjectives.forEach((o) => w.bullet(o));
  w.rule();

  course.slides.forEach((s, i) => {
    w.kicker(`Slide ${i + 1}`);
    w.heading(s.title, 14);
    s.bullets.forEach((b) => w.bullet(b));
    w.para('Speaker notes', { size: 9, color: [120, 130, 145] });
    w.para(s.notes);
    if (s.code?.code) {
      w.code(s.code.code);
      w.para(`Expected output: ${s.code.expectedOutput}`, { size: 9, color: [100, 110, 125] });
    }
    w.rule();
  });

  course.exercises.forEach((e, i) => {
    w.kicker(`Exercise ${i + 1}`);
    w.heading(e.title, 14);
    w.para(e.prompt);
    w.para('Reference solution', { size: 9, color: [120, 130, 145] });
    w.code(e.solution);
    e.tests.forEach((t) => w.bullet(`${t.description}: ${t.input} -> ${t.expectedOutput}`));
    w.rule();
  });

  w.kicker('Quiz with answer key');
  course.quiz.forEach((q, i) => {
    w.heading(`${i + 1}. ${q.question}`, 11);
    q.options.forEach((o, oi) => w.para(`${String.fromCharCode(65 + oi)}. ${o}${oi === q.correctIndex ? '   (correct)' : ''}`, { indent: 12 }));
    w.para(q.explanation, { size: 9.5, color: [100, 110, 125], indent: 12 });
  });
  w.rule();
  w.kicker('Cheat sheet');
  course.cheatSheet.forEach((c) => w.bullet(c));

  footer(doc, meta);
  doc.save(`${fileSafe(course.title)}-notes.pdf`);
}

const BAND_TEXT = {
  LOW: 'LOW - Invalid. Material was automatically regenerated.',
  MEDIUM: 'MEDIUM - Needs trainer review before use. See suggested fixes.',
  HIGH: 'HIGH - Valid. Material accepted for classroom use.',
};

export async function downloadReportPdf(course: Course, verification: Verification, meta: Meta, attempts: number) {
  const doc = await newPdf();
  cover(doc, `Verification report: ${course.title}`, `Generated ${new Date(verification.verifiedAt).toLocaleString()} · ${attempts} attempt(s) · verifier ${verification.model}`, meta, 'Verification');
  const w = writer(doc, meta.accent);
  w.y = 226;

  w.kicker('Confidence score');
  w.heading(`${verification.score}%  ·  ${verification.band}`, 22);
  w.para(BAND_TEXT[verification.band], { size: 11 });
  w.para(`CS = ${verification.formula} = ${verification.cs}`, { size: 9.5, color: [100, 110, 125] });
  w.para(`Final = CS x 100 = ${verification.score}%`, { size: 9.5, color: [100, 110, 125] });
  w.rule();

  w.kicker('Metric breakdown');
  (Object.keys(verification.metrics) as (keyof typeof verification.metrics)[]).forEach((k) => {
    const v = verification.metrics[k];
    const wt = verification.weights[k];
    w.para(`${k}  ${verification.labels[k]}  -  value ${v.toFixed(2)} × weight ${wt.toFixed(2)} = ${(v * wt).toFixed(3)}`);
  });
  w.rule();

  w.kicker('Snippet results');
  verification.snippets.forEach((s) => {
    const pass = s.compiles && s.staticValid && s.outputMatches;
    w.heading(`${pass ? 'PASS' : 'FAIL'}  ${s.id} - ${s.source}`, 11);
    w.para(`Compiles: ${s.compiles ? 'yes' : 'no'} · Static validity ${(s.validity * 100).toFixed(0)}% · Analysis ${(s.analysis * 100).toFixed(0)}% · ${s.kind === 'slide' ? 'Output matches' : 'All tests pass'}: ${s.outputMatches ? 'yes' : 'no'} · Semantic ${(s.semanticScore * 100).toFixed(0)}%`, { size: 9.5 });
    s.findings.forEach((f) => w.bullet(f));
  });
  w.rule();

  w.kicker('Exercise tests');
  verification.exercises.forEach((e) => {
    w.para(`${e.id} ${e.title}: ${e.testsPassed}/${e.testsTotal} tests passed${e.notes ? ` - ${e.notes}` : ''}`);
  });

  if (verification.suggestions.length) {
    w.rule();
    w.kicker('Suggested fixes');
    verification.suggestions.forEach((s) => w.bullet(s));
  }

  w.rule();
  w.para('Execution and test evaluation is performed by an independent AI verifier combined with deterministic static analysis. It is evidence, not a formal certification; run code in a sandbox before production use.', { size: 8.5, color: [130, 140, 155] });

  footer(doc, meta);
  doc.save(`${fileSafe(course.title)}-verification-report.pdf`);
}
