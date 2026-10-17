'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Snippet = {
  snippet_id: string; title?: string; language?: string; status?: string; error?: string;
  source_locations?: Array<{slide_id?: string; exercise_id?: string; location?: string}>;
  execution?: { exit_code?: number | null; stdout?: string; stderr?: string; runtime_image?: string; execution_isolated?: boolean };
};
type Material = {
  id: string; job_id?: string; status: string; progress?: number; title?: string; generation_mode?: string;
  confidence?: {score?: number; band?: string; raw_score?: number; mandatory_gates_passed?: boolean; metrics?: Record<string, number>};
  summary?: Record<string, number | string>; snippets?: Snippet[]; verification_report?: any;
  download_url?: string; pptx_url?: string; pdf_url?: string; error?: string; request?: any;
};
const API = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const terminalStatuses = new Set(['VERIFIED', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED']);

function statusClass(status?: string) {
  if (status === 'VERIFIED' || status === 'PASSED' || status === 'HIGH') return 'pill good';
  if (status === 'NEEDS_REVIEW' || status === 'EXPECTED_FAILURE' || status === 'ARTIFACT_ONLY' || status === 'MEDIUM') return 'pill warn';
  if (status === 'FAILED' || status === 'BLOCKED' || status === 'ERROR' || status === 'LOW') return 'pill bad';
  return 'pill neutral';
}
function niceStatus(status?: string) { return (status || 'UNKNOWN').replaceAll('_', ' '); }

export default function Home() {
  const [topic, setTopic] = useState('REST APIs with Spring Boot');
  const [level, setLevel] = useState('beginner');
  const [duration, setDuration] = useState('60');
  const [language, setLanguage] = useState('java');
  const [framework, setFramework] = useState('Spring Boot');
  const [frameworkVersion, setFrameworkVersion] = useState('3.x (pin exact patch for release)');
  const [sourceText, setSourceText] = useState('');
  const [brand, setBrand] = useState('TechSummitTrainers');
  const [primary, setPrimary] = useState('#1D4ED8');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [material, setMaterial] = useState<Material | null>(null);
  const [recent, setRecent] = useState<Material[]>([]);
  const [snippetFilter, setSnippetFilter] = useState('ALL');
  const [slideId, setSlideId] = useState('SLIDE-01');
  const [slideInstruction, setSlideInstruction] = useState('Make the explanation more concise and add a practical example.');
  const [actionMessage, setActionMessage] = useState('');

  async function api(path: string, init?: RequestInit) {
    const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API ${response.status}: ${body.slice(0, 400)}`);
    }
    return response.json();
  }

  async function refreshRecent() {
    try { setRecent(await api('/api/v1/materials')); } catch { /* API may not be running during initial render */ }
  }
  useEffect(() => { void refreshRecent(); }, []);

  async function loadMaterial(id: string) {
    const value = await api(`/api/v1/materials/${id}`);
    setMaterial(value);
    return value as Material;
  }

  async function generate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setActionMessage(''); setMaterial(null);
    try {
      const queued = await api('/api/v1/materials/generate', { method: 'POST', body: JSON.stringify({
        topic, student_level: level, duration_minutes: Number(duration), source_text: sourceText || null,
        programming_language: language, framework, framework_version: frameworkVersion,
        brand_name: brand, brand_primary_color: primary,
      }) });
      setActionMessage('Generation queued. Content generation and sandbox checks are running.');
      let terminal = false;
      for (let i = 0; i < 360 && !terminal; i++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const job = await api(`/api/v1/jobs/${queued.job_id}`);
        setMaterial((prev) => ({ ...(prev || {} as Material), ...job, id: queued.job_id }));
        terminal = terminalStatuses.has(job.status);
      }
      const complete = await loadMaterial(queued.material_id);
      setActionMessage(complete.status === 'VERIFIED' ? 'Course pack is verified and ready.' : `Course generation finished with status: ${niceStatus(complete.status)}. Review the report before using it in class.`);
      await refreshRecent();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unexpected error'); }
    finally { setBusy(false); }
  }

  async function selectExisting(id: string) {
    try { setError(''); setMaterial(await loadMaterial(id)); setActionMessage('Loaded saved course material.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load course'); }
  }

  async function reverify() {
    if (!material) return;
    try { await api(`/api/v1/materials/${material.id}/verify-code`, { method: 'POST', body: '{}' }); setActionMessage('Verification queued. Refreshing results…');
      for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 1500)); const job = await api(`/api/v1/jobs/${material.id}`); if (terminalStatuses.has(job.status)) break; }
      await loadMaterial(material.id); await refreshRecent(); setActionMessage('Verification report refreshed.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Verification failed'); }
  }

  async function regenerateSlide() {
    if (!material) return;
    try { setActionMessage('Submitting slide regeneration…'); setError('');
      const result = await api(`/api/v1/materials/${material.id}/slides/${slideId}/regenerate`, {method:'POST', body:JSON.stringify({trainer_instruction:slideInstruction})});
      setMaterial(result); setActionMessage(`Slide request processed. Current status: ${niceStatus(result.status)}. Review the regeneration note in the report.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Slide regeneration failed'); }
  }

  const snippets = material?.snippets || [];
  const visibleSnippets = useMemo(() => snippets.filter(s => snippetFilter === 'ALL' || s.status === snippetFilter), [snippets, snippetFilter]);
  const confidence = material?.confidence || material?.verification_report?.confidence;
  const report = material?.verification_report;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark">VC</div><div><div className="brand-name">Verified Course Studio</div><div className="brand-sub">by {brand || 'TechSummitTrainers'}</div></div></div>
      <div className="topbar-right"><span className="secure-label"><span className="dot"/> Sandbox-first verification</span><a href={`${API}/docs`} target="_blank" rel="noreferrer">API docs ↗</a></div>
    </header>

    <section className="hero">
      <div className="hero-copy"><div className="eyebrow">PS5 · COURSE MATERIAL AUTOMATION</div><h1>Turn any topic into a <span>verified course pack.</span></h1><p>Generate branded slides, trainer notes, runnable code, tested exercises, quiz material and a separate file for every extracted snippet.</p>
        <div className="hero-tags"><span>PowerPoint + PDF</span><span>Extracted code</span><span>Sandbox logs</span><span>Confidence score / 100</span></div>
      </div>
      <div className="hero-card"><div className="hero-card-title">Pipeline overview</div>{['Generate course content','Extract every snippet','Run isolated checks','Score + package results'].map((item,i)=><div className="pipeline-row" key={item}><span className="pipeline-num">0{i+1}</span><span>{item}</span><span className="pipeline-arrow">{i===3?'✓':'→'}</span></div>)}<div className="hero-card-foot">AI output is a draft until mandatory checks pass.</div></div>
    </section>

    <div className="workspace">
      <section className="panel input-panel">
        <div className="panel-heading"><div><div className="section-kicker">01 / CONFIGURE</div><h2>Create course pack</h2></div><span className="tiny-badge">MVP</span></div>
        <form onSubmit={generate} className="form-stack">
          <label>Topic or course title<input value={topic} onChange={e=>setTopic(e.target.value)} minLength={3} maxLength={240} required placeholder="e.g. REST APIs with Spring Boot"/></label>
          <div className="form-row"><label>Student level<select value={level} onChange={e=>setLevel(e.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label>Duration (minutes)<input type="number" value={duration} min={15} max={480} onChange={e=>setDuration(e.target.value)} required/></label></div>
          <div className="form-row"><label>Code language<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="java">Java</option><option value="python">Python</option></select></label><label>Framework<input value={framework} onChange={e=>setFramework(e.target.value)}/></label></div>
          <label>Framework/runtime version<input value={frameworkVersion} onChange={e=>setFrameworkVersion(e.target.value)} placeholder="Exact version / approved profile"/></label>
          <label>Source notes or pasted input <span className="optional">optional</span><textarea value={sourceText} onChange={e=>setSourceText(e.target.value)} rows={4} maxLength={30000} placeholder="Paste requirements, syllabus notes or source material…"/></label>
          <div className="subsection-title">Institute branding</div>
          <div className="form-row brand-row"><label>Brand name<input value={brand} onChange={e=>setBrand(e.target.value)} maxLength={100}/></label><label>Accent color<div className="color-input"><input type="color" value={primary} onChange={e=>setPrimary(e.target.value)}/><span>{primary.toUpperCase()}</span></div></label></div>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="spinner"/> Generating & verifying…</> : <>Generate course pack <span>→</span></>}</button>
          <p className="form-footnote">No API key? Demo content mode still exercises packaging and verification. A demo output is not automatically verified.</p>
        </form>
      </section>

      <section className="panel results-panel">
        <div className="panel-heading"><div><div className="section-kicker">02 / VERIFY & EXPORT</div><h2>Course workspace</h2></div>{material && <span className={statusClass(material.status)}>{niceStatus(material.status)}</span>}</div>
        {error && <div className="alert error"><b>Something went wrong</b><span>{error}</span></div>}
        {actionMessage && <div className="alert info"><span>{actionMessage}</span></div>}
        {!material ? <div className="empty-state"><div className="empty-icon">✦</div><h3>Your generated course appears here</h3><p>Configure the session, then generate the material. The result will include all output files and a snippet-by-snippet report.</p><div className="empty-checks"><span>✓ Speaker notes per slide</span><span>✓ Separate code files</span><span>✓ Pass/fail log</span></div></div> : <>
          <div className="material-title"><div><h3>{material.title || material.request?.topic || material.id}</h3><p>{material.id} · {material.generation_mode || 'processing'}</p></div>{confidence && <div className="score-ring" style={{'--score':`${confidence.score || 0}%`} as React.CSSProperties}><div><strong>{confidence.score ?? '—'}</strong><small>/100</small></div></div>}</div>
          {busy && <div className="progress-wrap"><div className="progress-label"><span>Generation and verification</span><b>{material.progress || 0}%</b></div><div className="progress-track"><div style={{width:`${material.progress || 0}%`}}/></div></div>}
          {confidence && <div className="score-summary"><span className={statusClass(confidence.band)}>{confidence.band || 'UNSCORED'}</span><span>{confidence.mandatory_gates_passed ? 'Mandatory gates passed' : 'One or more mandatory gates did not pass'}</span></div>}
          <div className="output-grid"><a href={`${API}/api/v1/materials/${material.id}/export?format=pptx`} target="_blank" rel="noreferrer" className="output-card"><span className="file-icon ppt">P</span><span><b>PowerPoint</b><small>.pptx · editable slides</small></span><span className="download">↓</span></a><a href={`${API}/api/v1/materials/${material.id}/export?format=pdf`} target="_blank" rel="noreferrer" className="output-card"><span className="file-icon pdf">PDF</span><span><b>Slide PDF</b><small>.pdf · classroom ready</small></span><span className="download">↓</span></a><a href={`${API}/api/v1/materials/${material.id}/download?format=zip`} className="output-card"><span className="file-icon zip">ZIP</span><span><b>Complete course pack</b><small>Notes, code, tests, logs, quiz</small></span><span className="download">↓</span></a><a href={`${API}/api/v1/materials/${material.id}/verification-report`} target="_blank" rel="noreferrer" className="output-card"><span className="file-icon report">✓</span><span><b>Verification report</b><small>JSON evidence + test results</small></span><span className="download">↗</span></a></div>
          <div className="metrics-grid"><Metric label="Extracted snippets" value={report?.summary?.snippets_found ?? snippets.length}/><Metric label="Passed" value={report?.summary?.snippets_passed ?? '—'} tone="green"/><Metric label="Failed" value={report?.summary?.snippets_failed ?? '—'} tone="red"/><Metric label="Blocked" value={report?.summary?.snippets_blocked ?? '—'} tone="amber"/></div>
          <div className="section-divider"/>
          <div className="snippet-heading"><div><h3>Code extraction manager</h3><p>Every snippet has a source link and execution evidence.</p></div><button className="secondary-button" onClick={reverify} disabled={busy}>Re-run verification</button></div>
          <div className="filter-row">{['ALL','PASSED','FAILED','BLOCKED','ARTIFACT_ONLY'].map(f=><button key={f} onClick={()=>setSnippetFilter(f)} className={snippetFilter===f?'filter active':'filter'}>{f.replaceAll('_',' ')}</button>)}</div>
          <div className="snippet-list">{visibleSnippets.length===0 ? <div className="no-snippets">No snippet items in this filter.</div> : visibleSnippets.map(s=><details className="snippet-item" key={s.snippet_id}><summary><span className="code-file-icon">&lt;/&gt;</span><span className="snippet-main"><b>{s.title || s.snippet_id}</b><small>{s.snippet_id} · {s.language} · {(s.source_locations||[]).map(loc=>loc.slide_id || loc.exercise_id || loc.location).filter(Boolean).join(', ')}</small></span><span className={statusClass(s.status)}>{niceStatus(s.status)}</span></summary><div className="snippet-detail">{s.error && <pre className="log error-log">{s.error}</pre>}{s.execution?.stdout && <><b>stdout</b><pre className="log">{s.execution.stdout}</pre></>}{s.execution?.stderr && <><b>stderr</b><pre className="log error-log">{s.execution.stderr}</pre></>}{s.execution?.runtime_image && <p className="muted">Runtime image: {s.execution.runtime_image}</p>}{!s.error&&!s.execution?.stdout&&!s.execution?.stderr&&<p className="muted">No execution log. This can be an artifact-only test harness or a blocked sandbox request.</p>}</div></details>)}</div>
          <div className="section-divider"/>
          <div className="snippet-heading"><div><h3>Regenerate a single slide</h3><p>Request a focused edit and re-run verification.</p></div></div>
          <div className="slide-regenerate"><label>Slide ID<input value={slideId} onChange={e=>setSlideId(e.target.value)} placeholder="SLIDE-01"/></label><label>Instruction<textarea value={slideInstruction} onChange={e=>setSlideInstruction(e.target.value)} rows={2}/></label><button className="secondary-button" onClick={regenerateSlide}>Submit slide update</button><p className="form-footnote">In this MVP, slide edits are annotated and the deck is rebuilt; model-driven rewriting is a follow-on integration.</p></div>
          {report?.warnings?.length > 0 && <div className="warnings"><b>Verification notes</b>{report.warnings.map((w:string)=><p key={w}>• {w}</p>)}</div>}
        </>}
      </section>
    </div>

    <section className="panel recent-panel"><div className="panel-heading"><div><div className="section-kicker">03 / HISTORY</div><h2>Recent course packs</h2></div><button className="text-button" onClick={refreshRecent}>Refresh ↻</button></div>{recent.length===0?<p className="muted">No course packs yet. Generated courses will appear here.</p>:<div className="recent-list">{recent.slice(0,6).map(r=><button key={r.id} className={`recent-item ${material?.id===r.id?'selected':''}`} onClick={()=>selectExisting(r.id)}><span className="recent-icon">▤</span><span className="recent-main"><b>{r.title || r.request?.topic || r.id}</b><small>{r.id}</small></span><span className={statusClass(r.status)}>{niceStatus(r.status)}</span></button>)}</div>}</section>

    <footer><span>TechSummitTrainers · Verified Course Material Studio</span><span>Never equate AI confidence with execution proof.</span></footer>
  </main>;
}

function Metric({label,value,tone}:{label:string;value:string|number;tone?:'green'|'red'|'amber'}) {
  return <div className="metric-card"><span>{label}</span><strong className={tone || ''}>{value}</strong></div>;
}
