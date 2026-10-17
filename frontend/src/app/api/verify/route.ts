import { generateText, Output } from 'ai';
import { z } from 'zod';
import {
  courseSchema,
  executionSchema,
  type ExerciseResult,
  type MetricKey,
  type SnippetResult,
  type Verification,
} from '@/lib/course-schema';
import { clamp01, computeConfidence } from '@/lib/scoring';
import { runStaticChecks } from '@/lib/static-checks';
import { findExerciseFixture, findSnippetFixture } from '@/lib/snippet-bank';

export const maxDuration = 300;

const MODEL = 'openai/gpt-5.4-mini';

const bodySchema = z.object({
  course: courseSchema,
  language: z.enum(['java', 'python']),
  topic: z.string().max(240),
  execution: executionSchema.nullable().optional(),
});

const verdictSchema = z.object({
  snippets: z.array(
    z.object({
      id: z.string(),
      compiles: z.boolean(),
      actualOutput: z.string(),
      outputMatchesExpected: z.boolean(),
      semanticScore: z.number(),
      issues: z.array(z.string()),
    }),
  ),
  exercises: z.array(
    z.object({
      id: z.string(),
      solutionCompiles: z.boolean(),
      tests: z.array(z.object({ passed: z.boolean(), actual: z.string() })),
      notes: z.string(),
    }),
  ),
  suggestions: z.array(z.string()),
});

type Verdict = z.infer<typeof verdictSchema>;

const sameOutput = (a: string, b: string) => a.replace(/\r\n/g, '\n').trimEnd() === b.replace(/\r\n/g, '\n').trimEnd();

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid course payload' }, { status: 400 });
  const { course, language, topic, execution } = parsed.data;
  const lang = language === 'java' ? 'Java 21' : 'Python 3.12';

  const slideSnippets = course.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.code && s.code.code.trim())
    .map(({ s, i }) => ({
      id: `SLIDE-${String(i + 1).padStart(2, '0')}`,
      source: s.title,
      code: s.code!.code,
      expected: s.code!.expectedOutput,
      context: s.bullets.join(' | '),
    }));
  const exerciseSnippets = course.exercises.map((e, i) => ({
    id: `EX-${String(i + 1).padStart(2, '0')}`,
    source: e.title,
    code: e.solution,
    prompt: e.prompt,
    tests: e.tests,
  }));

  const evidence: string[] = [];
  if (execution) evidence.push(`Executed in ${execution.runtime}`);

  let verdict: Verdict | null = null;
  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: verdictSchema }),
      system: `You are a strict ${lang} compiler, runtime and test harness. You did NOT write this code and must not trust it.
For every slide snippet: decide if it compiles and runs without error exactly as written, trace it line by line to determine its precise stdout, compare to the expected output (ignore trailing newline only), and rate semanticScore 0-1 for how accurately the code demonstrates the slide's stated concept.
For every exercise: decide if the solution compiles, then evaluate each test's input expression against the solution and report whether the result equals expectedOutput exactly.
List concrete issues. Be skeptical: any syntax error, missing import, wrong output or runtime exception is a failure.
Return entries in the same order and with the same ids you were given. "suggestions" must be specific, actionable fixes for the trainer (empty if everything is correct).`,
      prompt: JSON.stringify({ topic, slideSnippets, exerciseSnippets }),
    });
    verdict = output;
    evidence.push(`Semantic review by AI verifier ${MODEL}`);
  } catch (error) {
    console.error('[verify] AI verifier unavailable, using deterministic checks:', error instanceof Error ? error.message : error);
    evidence.push('AI verifier unavailable - semantic score from deterministic fixture and output checks');
  }
  evidence.push('Deterministic static analysis (syntax, structure, safety, style)');

  const suggestions = new Set<string>(verdict?.suggestions ?? []);

  const snippets: SnippetResult[] = [
    ...slideSnippets.map((sn, idx) => {
      const v = verdict?.snippets.find((x) => x.id === sn.id) ?? verdict?.snippets[idx];
      const ran = execution?.snippets.find((x) => x.id === sn.id);
      const fixture = findSnippetFixture(sn.code);
      const st = runStaticChecks(sn.code, language, 'slide');
      const findings = [...st.findings];

      let compiles: boolean;
      let outputMatches: boolean;
      if (ran) {
        compiles = ran.ok;
        outputMatches = ran.ok && sameOutput(ran.stdout, sn.expected);
        if (!ran.ok) findings.push(`Runtime error: ${ran.error}`);
        else if (!outputMatches) findings.push(`Actual output "${ran.stdout.trimEnd().slice(0, 200)}" differs from expected "${sn.expected.slice(0, 200)}"`);
      } else if (v) {
        compiles = v.compiles;
        outputMatches = v.outputMatchesExpected;
      } else {
        compiles = fixture !== undefined || st.valid;
        outputMatches = fixture !== undefined && sameOutput(fixture, sn.expected);
        if (fixture === undefined) findings.push('Not executed: no runtime evidence available for this snippet');
      }

      const semantic = v ? clamp01(v.semanticScore) : outputMatches ? (fixture !== undefined ? 1 : 0.85) : compiles ? 0.5 : 0.2;
      if (v?.issues) findings.push(...v.issues);
      if (!outputMatches) suggestions.add(`${sn.id} "${sn.source}": update the code or the expected output so they agree.`);

      return {
        id: sn.id,
        source: sn.source,
        kind: 'slide' as const,
        staticValid: st.valid,
        validity: st.validity,
        analysis: st.analysis,
        compiles,
        outputMatches,
        semanticScore: semantic,
        findings,
      };
    }),
    ...exerciseSnippets.map((ex, idx) => {
      const v = verdict?.exercises.find((x) => x.id === ex.id) ?? verdict?.exercises[idx];
      const ran = execution?.exercises.find((x) => x.id === ex.id);
      const fixture = findExerciseFixture(ex.code);
      const st = runStaticChecks(ex.code, language, 'exercise');
      const findings = [...st.findings];

      let compiles: boolean;
      let passed: number;
      if (ran) {
        compiles = ran.compiles;
        passed = ran.tests.filter((t) => t.passed).length;
        if (!ran.compiles) findings.push(`Solution failed to load: ${ran.error}`);
        ran.tests.forEach((t, i) => {
          if (!t.passed && ex.tests[i]) findings.push(`Test "${ex.tests[i].description}": ${ex.tests[i].input} returned ${t.actual.slice(0, 160)}, expected ${ex.tests[i].expectedOutput}`);
        });
      } else if (v) {
        compiles = v.solutionCompiles;
        passed = v.tests.filter((t) => t.passed).length;
        if (v.notes) findings.push(v.notes);
      } else {
        compiles = fixture !== undefined || st.valid;
        passed = fixture
          ? ex.tests.filter((t) => fixture.tests.some((f) => f.input === t.input && f.expectedOutput === t.expectedOutput)).length
          : 0;
        if (!fixture) findings.push('Not executed: no runtime evidence available for this solution');
      }
      if (passed < ex.tests.length) suggestions.add(`${ex.id} "${ex.source}": fix the solution or test expectations (${passed}/${ex.tests.length} passing).`);

      return {
        id: ex.id,
        source: ex.source,
        kind: 'exercise' as const,
        staticValid: st.valid,
        validity: st.validity,
        analysis: st.analysis,
        compiles,
        outputMatches: ex.tests.length > 0 && passed === ex.tests.length,
        semanticScore: ex.tests.length ? passed / ex.tests.length : 0,
        findings,
        passed,
      };
    }),
  ];

  const exercises: ExerciseResult[] = exerciseSnippets.map((ex) => {
    const s = snippets.find((x) => x.id === ex.id) as SnippetResult & { passed: number };
    return {
      id: ex.id,
      title: ex.source,
      testsPassed: s.passed,
      testsTotal: ex.tests.length,
      notes: s.findings.join(' '),
    };
  });

  const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const slideOnly = snippets.filter((s) => s.kind === 'slide');
  const totalTests = exercises.reduce((a, e) => a + e.testsTotal, 0);
  const passedTests = exercises.reduce((a, e) => a + e.testsPassed, 0);

  const metrics: Record<MetricKey, number> = {
    CE: avg(snippets.map((s) => (s.compiles && s.staticValid ? 1 : 0))),
    TC: totalTests ? passedTests / totalTests : 0,
    SA: avg(snippets.map((s) => s.analysis)),
    CV: avg(snippets.map((s) => s.validity)),
    SV: avg(slideOnly.map((s) => s.semanticScore * (s.outputMatches ? 1 : 0.5))),
  };

  const confidence = computeConfidence(metrics);
  const result: Verification = {
    metrics,
    weights: confidence.weights,
    labels: confidence.labels,
    formula: confidence.formula,
    cs: confidence.cs,
    score: confidence.score,
    band: confidence.band,
    snippets: snippets.map(({ ...s }) => {
      delete (s as { passed?: number }).passed;
      return s;
    }),
    exercises,
    suggestions: [...suggestions].slice(0, 12),
    verifiedAt: new Date().toISOString(),
    model: verdict ? MODEL : execution ? execution.runtime : 'deterministic checks',
    evidence,
  };
  return Response.json(result);
}
