import { generateText, Output } from 'ai';
import { courseRequestSchema, courseSchema } from '@/lib/course-schema';
import { buildTemplateCourse } from '@/lib/template-course';

export const maxDuration = 300;

const MODEL = 'openai/gpt-5.4-mini';

export async function POST(req: Request) {
  const parsed = courseRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
  }
  const r = parsed.data;
  const lang = r.language === 'java' ? 'Java 21' : 'Python 3.12';

  const feedbackBlock = r.feedback.length
    ? `\n\nA previous attempt FAILED verification. Fix every one of these issues:\n- ${r.feedback.join('\n- ')}`
    : '';

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: courseSchema }),
      system: `You are a meticulous instructional designer and senior ${lang} engineer.
Produce course material whose code is correct, self-contained and runnable with only the standard library.
Rules:
- 6 to 8 slides. Each slide: concise title, 3-5 short bullets, detailed speaker notes (4-6 sentences) for the trainer.
- At least 3 slides must include "code": a complete runnable ${lang} program of at most 15 lines${
        r.language === 'java' ? ' with a public class and public static void main(String[] args)' : ''
      }. "expectedOutput" must be the exact stdout it prints. Use null for slides without code.
- Use 4-space indentation, no tabs, no trailing whitespace, no TODOs, no placeholders, no markdown fences.
- 2 exercises. "solution" is a complete reference ${lang} ${r.language === 'java' ? 'class with static methods' : 'module with functions'}. Each exercise has 3 tests: "input" is a concrete call expression (e.g. ${
        r.language === 'java' ? 'Solution.add(2, 3)' : 'add(2, 3)'
      }) and "expectedOutput" is its exact result.
- 5 quiz questions with 4 options each; correctIndex is 0-based.
- 6-8 cheat sheet lines.`,
      prompt: `Topic: ${r.topic}
Audience level: ${r.level}
Session duration: ${r.duration} minutes
Language: ${lang}${r.framework ? `\nFramework context: ${r.framework} (keep runnable code standard-library only)` : ''}${
        r.brandName ? `\nInstitute: ${r.brandName}` : ''
      }${r.sourceText ? `\n\nSource material to base the course on:\n${r.sourceText}` : ''}${feedbackBlock}`,
    });
    return Response.json({ course: output, model: MODEL, source: 'ai' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Generation failed';
    console.error('[generate] AI generation unavailable, using verified template library:', reason);
    return Response.json({
      course: buildTemplateCourse(r),
      model: 'template-library',
      source: 'template',
      notice: `AI generation unavailable (${reason.slice(0, 160)}). Built from the pre-verified snippet library instead.`,
    });
  }
}
