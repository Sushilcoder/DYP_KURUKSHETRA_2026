import type { Course, CourseRequest } from './course-schema';
import { JAVA_EXERCISES, JAVA_SNIPPETS, PYTHON_EXERCISES, PYTHON_SNIPPETS, type BankExercise, type BankSnippet } from './snippet-bank';

function tokens(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function rank<T extends { keywords: string[]; id: string }>(items: T[], words: Set<string>, seed: number) {
  return items
    .map((item, i) => ({ item, score: item.keywords.filter((k) => words.has(k)).length, tie: (i + seed) % items.length }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .map((x) => x.item);
}

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function topicRelevance(topic: string, keywords: string[]) {
  const words = tokens(topic);
  return keywords.some((k) => words.has(k)) ? 1 : 0;
}

export function buildTemplateCourse(r: CourseRequest): Course {
  const lang = r.language === 'java' ? 'Java' : 'Python';
  const words = tokens(`${r.topic} ${r.framework} ${r.sourceText.slice(0, 2000)}`);
  const seed = hash(r.topic.toLowerCase()) + r.feedback.length;
  const snippetCount = r.duration >= 90 ? 5 : 4;
  const snippets: BankSnippet[] = rank(r.language === 'java' ? JAVA_SNIPPETS : PYTHON_SNIPPETS, words, seed).slice(0, snippetCount);
  const exercises: BankExercise[] = rank(r.language === 'java' ? JAVA_EXERCISES : PYTHON_EXERCISES, words, seed).slice(0, 2);
  const topic = r.topic.trim();
  const brand = r.brandName || 'your institute';
  const minutesPerBlock = Math.max(5, Math.round(r.duration / (snippetCount + 3)));

  const intro = {
    title: `Why ${topic} matters`,
    bullets: [
      `Where ${topic} shows up in real ${lang} code`,
      `What you will be able to build by the end of this ${r.duration}-minute session`,
      'Every example you see today was compiled and executed before class',
    ],
    code: null,
    notes: `Open by connecting ${topic} to problems learners already recognise. Ask the room where they have seen similar ideas in code they have read. Set expectations: this ${r.level} session runs for about ${r.duration} minutes with hands-on exercises at the end. Mention that every snippet was verified by running it, so learners can trust the outputs on screen. Keep this slide under ${minutesPerBlock} minutes.`,
  };

  const content = snippets.map((s) => ({
    title: s.title,
    bullets: s.bullets,
    code: { code: s.code, expectedOutput: s.output },
    notes: `${s.explain} Walk through the code line by line before revealing the output, and ask learners to predict what it prints. Then show the expected output: ${s.output.replace(/\n/g, ' / ')}. Relate the example back to ${topic} and point out the key syntax on the slide. Invite one learner to suggest a small change and discuss how the output would differ. Budget roughly ${minutesPerBlock} minutes here.`,
  }));

  const practices = {
    title: `${topic}: habits that scale`,
    bullets: ['Prefer clear names over clever one-liners', 'Test small pieces before combining them', 'Read error messages top to bottom - they usually say exactly what broke', `Keep ${lang} code consistent with a formatter`],
    code: null,
    notes: `Shift from syntax to judgement. Explain that readable code is code your future teammates can maintain. Encourage learners to run tiny experiments instead of writing large programs at once. Show how the exercises that follow come with tests, which is the same habit professional teams use. Ask the group which habit they find hardest and why.`,
  };

  const recap = {
    title: 'Recap and next steps',
    bullets: [...snippets.slice(0, 3).map((s) => s.cheat), `Next: complete both exercises and the ${brand} quiz`],
    code: null,
    notes: `Summarise the session by revisiting each code example in one sentence. Ask learners to name one thing they will use in their own work this week. Point them to the cheat sheet in the course pack for quick reference. Introduce the two exercises and explain that each solution is checked against automated tests. Close by inviting questions before moving to the quiz.`,
  };

  return {
    title: `${topic} with ${lang}`,
    summary: `A ${r.level}-level, ${r.duration}-minute ${lang} session on ${topic}, with ${snippets.length} runnable examples, ${exercises.length} tested exercises and a ${snippets.length}-question knowledge check.`,
    learningObjectives: [
      `Explain the core ideas behind ${topic}`,
      ...snippets.slice(0, 3).map((s) => `Apply ${s.title.toLowerCase()} in ${lang}`),
      'Verify their own code with small, repeatable tests',
    ],
    slides: [intro, ...content, practices, recap],
    exercises: exercises.map((e) => ({ title: e.title, prompt: e.prompt, solution: e.solution, tests: e.tests })),
    quiz: snippets.map((s) => s.quiz),
    cheatSheet: [...snippets.map((s) => s.cheat), ...exercises.map((e) => `${e.title}: ${e.tests[0].input} -> ${e.tests[0].expectedOutput}`)].slice(0, 8),
  };
}
