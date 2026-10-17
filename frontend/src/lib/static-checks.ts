type Language = 'java' | 'python';

type Check = { ok: boolean; message: string };

export type StaticResult = {
  valid: boolean;
  validity: number;
  analysis: number;
  findings: string[];
};

function bracketsBalanced(code: string, language: Language) {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next2 = code.slice(i, i + 2);
    const next3 = code.slice(i, i + 3);

    if (language === 'python' && (next3 === '"""' || next3 === "'''")) {
      const end = code.indexOf(next3, i + 3);
      if (end === -1) return false;
      i = end + 3;
      continue;
    }
    if ((language === 'python' && ch === '#') || (language === 'java' && next2 === '//')) {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end + 1;
      continue;
    }
    if (language === 'java' && next2 === '/*') {
      const end = code.indexOf('*/', i + 2);
      if (end === -1) return false;
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch && code[j] !== '\n') {
        if (code[j] === '\\') j++;
        j++;
      }
      if (code[j] !== ch) return false;
      i = j + 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    }
    i++;
  }
  return stack.length === 0;
}

function validityChecks(code: string, language: Language, kind: 'slide' | 'exercise'): Check[] {
  const checks: Check[] = [
    { ok: code.trim().length > 0, message: 'Snippet is empty' },
    { ok: !/```/.test(code), message: 'Markdown fences found inside code' },
    { ok: bracketsBalanced(code, language), message: 'Unbalanced brackets or unterminated string' },
  ];
  if (language === 'java') {
    checks.push({ ok: /\bclass\s+\w+/.test(code), message: 'Java snippet has no class declaration' });
    if (kind === 'slide') {
      checks.push({
        ok: /public\s+static\s+void\s+main\s*\(\s*String/.test(code),
        message: 'Runnable Java snippet is missing public static void main(String[] args)',
      });
    }
    const missingSemicolon = code
      .split('\n')
      .map((l) => l.trim())
      .some((l) => /^(return\b|System\.out\.|int |String |double |long |boolean |var )/.test(l) && !/[;{(,+]$/.test(l));
    checks.push({ ok: !missingSemicolon, message: 'Possible missing semicolon in Java statement' });
  } else {
    checks.push({ ok: !/\t/.test(code), message: 'Tab indentation found (use 4 spaces)' });
    const badIndent = code.split('\n').some((l) => {
      const lead = l.match(/^ */)?.[0].length ?? 0;
      return l.trim() && lead % 4 !== 0;
    });
    checks.push({ ok: !badIndent, message: 'Indentation is not a multiple of 4 spaces' });
    const blockOpeners = code
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trimEnd())
      .filter((l) => /^\s*(def|class|if|elif|else|for|while|try|except|finally|with)\b/.test(l));
    checks.push({
      ok: blockOpeners.every((l) => l.endsWith(':') || l.endsWith('(') || l.endsWith(',')),
      message: 'Python block statement missing trailing colon',
    });
    if (kind === 'exercise') checks.push({ ok: /\bdef\s+\w+\s*\(/.test(code), message: 'Exercise solution defines no function' });
  }
  return checks;
}

function analysisChecks(code: string, language: Language, kind: 'slide' | 'exercise'): Check[] {
  const lines = code.split('\n');
  return [
    { ok: lines.every((l) => l.length <= 100), message: 'Line longer than 100 characters' },
    { ok: !/\b(TODO|FIXME|XXX)\b/.test(code), message: 'Leftover TODO/FIXME marker' },
    {
      ok: !/(^|\s)\.\.\.(\s|$)|your code here|placeholder/i.test(code.replace(/"[^"\n]*"|'[^'\n]*'/g, '""')),
      message: 'Placeholder or truncated code',
    },
    { ok: kind === 'exercise' || lines.length <= 18, message: 'Slide snippet too long for a slide (> 18 lines)' },
    { ok: !lines.some((l) => /\s+$/.test(l)), message: 'Trailing whitespace' },
    {
      ok:
        language === 'java'
          ? !/System\.exit|Runtime\.getRuntime|ProcessBuilder/.test(code)
          : !/\b(eval|exec)\s*\(|os\.system|subprocess|__import__/.test(code),
      message: 'Unsafe or process-level call detected',
    },
    {
      ok: language === 'java' ? !/catch\s*\([^)]*\)\s*\{\s*\}/.test(code) : !/except\s*:\s*\n\s*pass/.test(code),
      message: 'Empty exception handler swallows errors',
    },
  ];
}

export function runStaticChecks(code: string, language: Language, kind: 'slide' | 'exercise'): StaticResult {
  const validity = validityChecks(code, language, kind);
  const analysis = analysisChecks(code, language, kind);
  const findings = [...validity, ...analysis].filter((c) => !c.ok).map((c) => c.message);
  const validityScore = validity.filter((c) => c.ok).length / validity.length;
  const analysisScore = analysis.filter((c) => c.ok).length / analysis.length;
  return {
    valid: validity.every((c) => c.ok),
    validity: validityScore,
    analysis: analysisScore,
    findings,
  };
}
