import { generateText, Output } from 'ai';
import { z } from 'zod';
import { courseSchema, type ExerciseResult, type MetricKey, type SnippetResult, type Verification } from '@/lib/course-schema';
import { clamp01, computeConfidence } from '@/lib/scoring';
import { runStaticChecks } from '@/lib/static-checks';

export const maxDuration = 300;

const MODEL = 'openai/gpt-5.4-mini';

const bodySchema = z.object({
  course: courseSchema,
  language: z.enum(['java', 'python']),
  topic: z.string().max(240),
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

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid course payload' }, { status: 400 });
  const { course, language, topic } = parsed.data;
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

  try {
    const { output: verdict } = await generateText({
      model: MODEL,
      output: Output.object({ schema: verdictSchema }),
      system: `You are a strict ${lang} compiler, runtime and test harness. You did NOT write this code and must not trust it.
For every slide snippet: decide if it compiles and runs without error exactly as written, trace it line by line to determine its precise stdout, compare to the expected output (ignore trailing newline only), and rate semanticScore 0-1 for how accurately the code demonstrates the slide's stated concept.
For every exercise: decide if the solution compiles, then evaluate each test's input expression against the solution and report whether the result equals expectedOutput exactly.
List concrete issues. Be skeptical: any syntax error, missing import, wrong output or runtime exception is a failure.
Return entries in the same order and with the same ids you were given. "suggestions" must be specific, actionable fixes for the trainer (empty if everything is correct).`,
      prompt: JSON.stringify({ topic, slideSnippets, exerciseSnippets }),
    });

    const snippets: SnippetResult[] = [
      ...slideSnippets.map((sn, idx) => {
        const v = verdict.snippets.find((x) => x.id === sn.id) ?? verdict.snippets[idx];
        const st = runStaticChecks(sn.code, language, 'slide');
        return {
          id: sn.id,
          source: sn.source,
          kind: 'slide' as const,
          staticValid: st.valid,
          validity: st.validity,
          analysis: st.analysis,
          compiles: Boolean(v?.compiles),
          outputMatches: Boolean(v?.outputMatchesExpected),
          semanticScore: clamp01(v?.semanticScore ?? 0),
          findings: [...st.findings, ...(v?.issues ?? [])],
        };
      }),
      ...exerciseSnippets.map((ex, idx) => {
        const v = verdict.exercises.find((x) => x.id === ex.id) ?? verdict.exercises[idx];
        const st = runStaticChecks(ex.code, language, 'exercise');
        const passed = v?.tests.filter((t) => t.passed).length ?? 0;
        return {
          id: ex.id,
          source: ex.source,
          kind: 'exercise' as const,
          staticValid: st.valid,
          validity: st.validity,
          analysis: st.analysis,
          compiles: Boolean(v?.solutionCompiles),
          outputMatches: ex.tests.length > 0 && passed === ex.tests.length,
          semanticScore: ex.tests.length ? passed / ex.tests.length : 0,
          findings: [...st.findings, ...(v?.notes ? [v.notes] : [])],
        };
      }),
    ];

    const exercises: ExerciseResult[] = exerciseSnippets.map((ex, idx) => {
      const v = verdict.exercises.find((x) => x.id === ex.id) ?? verdict.exercises[idx];
      return {
        id: ex.id,
        title: ex.source,
        testsPassed: v?.tests.filter((t) => t.passed).length ?? 0,
        testsTotal: ex.tests.length,
        notes: v?.notes ?? '',
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
      snippets,
      exercises,
      suggestions: verdict.suggestions,
      verifiedAt: new Date().toISOString(),
      model: MODEL,
    };
    return Response.json(result);
  } catch (error) {
    console.error('[verify] failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Verification failed' }, { status: 500 });
  }
}
