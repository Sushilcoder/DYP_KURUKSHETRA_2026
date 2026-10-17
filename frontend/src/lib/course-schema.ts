import { z } from 'zod';

export const courseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  slides: z.array(
    z.object({
      title: z.string(),
      bullets: z.array(z.string()),
      code: z
        .object({
          code: z.string(),
          expectedOutput: z.string(),
        })
        .nullable(),
      notes: z.string(),
    }),
  ),
  exercises: z.array(
    z.object({
      title: z.string(),
      prompt: z.string(),
      solution: z.string(),
      tests: z.array(
        z.object({
          description: z.string(),
          input: z.string(),
          expectedOutput: z.string(),
        }),
      ),
    }),
  ),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number().int(),
      explanation: z.string(),
    }),
  ),
  cheatSheet: z.array(z.string()),
});

export type Course = z.infer<typeof courseSchema>;

export const courseRequestSchema = z.object({
  topic: z.string().trim().min(3).max(240),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  duration: z.number().int().min(15).max(480),
  language: z.enum(['java', 'python']),
  framework: z.string().trim().max(80).default(''),
  sourceText: z.string().max(20000).default(''),
  brandName: z.string().trim().max(100).default(''),
  feedback: z.array(z.string().max(600)).max(25).default([]),
});

export type CourseRequest = z.infer<typeof courseRequestSchema>;

export const METRIC_KEYS = ['CE', 'TC', 'SA', 'CV', 'SV'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type Band = 'LOW' | 'MEDIUM' | 'HIGH';

export type SnippetResult = {
  id: string;
  source: string;
  kind: 'slide' | 'exercise';
  staticValid: boolean;
  validity: number;
  analysis: number;
  compiles: boolean;
  outputMatches: boolean;
  semanticScore: number;
  findings: string[];
};

export type ExerciseResult = {
  id: string;
  title: string;
  testsPassed: number;
  testsTotal: number;
  notes: string;
};

export type Verification = {
  metrics: Record<MetricKey, number>;
  weights: Record<MetricKey, number>;
  labels: Record<MetricKey, string>;
  formula: string;
  cs: number;
  score: number;
  band: Band;
  snippets: SnippetResult[];
  exercises: ExerciseResult[];
  suggestions: string[];
  verifiedAt: string;
  model: string;
};
