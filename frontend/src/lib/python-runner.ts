import type { Course, Execution } from './course-schema';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/npm/pyodide@0.29.3/';
const TIMEOUT_MS = 45000;

const WORKER_SOURCE = `
importScripts('${PYODIDE_URL}pyodide.js');
let py = null;
self.onmessage = async (event) => {
  const { snippets, exercises } = event.data;
  try {
    py = py || await loadPyodide({ indexURL: '${PYODIDE_URL}' });
  } catch (err) {
    self.postMessage({ fatal: String(err && err.message || err) });
    return;
  }
  const lastLine = (err) => String(err && err.message || err).trim().split('\\n').slice(-1)[0].slice(0, 400);
  const snippetResults = [];
  for (const s of snippets) {
    let out = '';
    py.setStdout({ batched: (line) => { out += line + '\\n'; } });
    py.setStderr({ batched: () => {} });
    const globals = py.toPy({ __name__: '__main__' });
    try {
      await py.runPythonAsync(s.code, { globals });
      snippetResults.push({ id: s.id, ok: true, stdout: out, error: '' });
    } catch (err) {
      snippetResults.push({ id: s.id, ok: false, stdout: out, error: lastLine(err) });
    } finally {
      globals.destroy();
    }
  }
  const exerciseResults = [];
  for (const e of exercises) {
    py.setStdout({ batched: () => {} });
    const globals = py.toPy({ __name__: 'solution' });
    let compiles = true;
    let error = '';
    try {
      await py.runPythonAsync(e.solution, { globals });
    } catch (err) {
      compiles = false;
      error = lastLine(err);
    }
    const tests = e.tests.map((t) => {
      if (!compiles) return { passed: false, actual: error };
      try {
        const asStr = py.runPython('str(' + t.input + ')', { globals });
        const asRepr = py.runPython('repr(' + t.input + ')', { globals });
        const expected = String(t.expectedOutput).trim();
        return { passed: asStr === expected || asRepr === expected, actual: asRepr };
      } catch (err) {
        return { passed: false, actual: lastLine(err) };
      }
    });
    globals.destroy();
    exerciseResults.push({ id: e.id, compiles, error, tests });
  }
  self.postMessage({ snippets: snippetResults, exercises: exerciseResults });
};
`;

let worker: Worker | null = null;

function getWorker() {
  if (!worker) {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url);
  }
  return worker;
}

export async function executePython(course: Course): Promise<Execution> {
  const snippets = course.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.code?.code.trim())
    .map(({ s, i }) => ({ id: `SLIDE-${String(i + 1).padStart(2, '0')}`, code: s.code!.code }));
  const exercises = course.exercises.map((e, i) => ({ id: `EX-${String(i + 1).padStart(2, '0')}`, solution: e.solution, tests: e.tests }));

  const w = getWorker();
  return new Promise<Execution>((resolve, reject) => {
    const timer = setTimeout(() => {
      w.terminate();
      worker = null;
      reject(new Error('Python execution timed out'));
    }, TIMEOUT_MS);
    w.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      if (event.data.fatal) reject(new Error(event.data.fatal));
      else resolve({ runtime: 'Pyodide 0.29 (CPython 3.13, WebAssembly sandbox)', ...event.data });
    };
    w.onerror = (event) => {
      clearTimeout(timer);
      w.terminate();
      worker = null;
      reject(new Error(event.message || 'Python runtime failed to load'));
    };
    w.postMessage({ snippets, exercises });
  });
}
