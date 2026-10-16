
"use client";

import { useState } from "react";

const sections = [
  "Course Overview",
  "Slides & Notes",
  "Code Examples",
  "Verification Center",
  "Exercises & Tests",
  "Export Center",
];

export default function Home() {
  const [topic, setTopic] = useState("Java Inheritance");
  const [level, setLevel] = useState("Beginner");
  const [duration, setDuration] = useState("60");
  const [section, setSection] = useState("Course Overview");
  const [apiStatus, setApiStatus] = useState("Not checked");

  async function checkBackend() {
    setApiStatus("Checking...");
    try {
      const response = await fetch(
        "http://localhost:8000/api/health"
      );
      if (!response.ok) throw new Error("Backend unavailable");
      const data = await response.json();
      setApiStatus(data.status === "healthy" ? "Connected" : "Unavailable");
    } catch {
      setApiStatus("Not connected");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-400">
              VERIFIED COURSE MATERIAL STUDIO
            </p>
            <h1 className="mt-1 text-xl font-bold">
              Trainer Workspace
            </h1>
          </div>
          <button
            onClick={checkBackend}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            API: {apiStatus}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[230px_1fr]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Workspace
          </p>
          <nav className="space-y-1">
            {sections.map((item) => (
              <button
                key={item}
                onClick={() => setSection(item)}
                className={`w-full rounded-lg px-3 py-3 text-left text-sm ${
                  section === item
                    ? "bg-cyan-400/10 font-semibold text-cyan-300"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          <div>
            <p className="text-sm text-cyan-400">PHASE 1 · FOUNDATION</p>
            <h2 className="mt-2 text-3xl font-bold">
              {section}
            </h2>
            <p className="mt-2 text-slate-400">
              Create reliable, branded teaching materials with
              verifiable code examples.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Course", "Not generated"],
              ["Code verification", "Not run"],
              ["Exports", "Not generated"],
            ].map(([title, value]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <p className="text-sm text-slate-400">{title}</p>
                <p className="mt-3 font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold">Create a course</h3>
            <p className="mt-1 text-sm text-slate-400">
              Configure your first teaching session.
            </p>

            <form
              className="mt-6 grid gap-5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                setSection("Course Overview");
              }}
            >
              <label className="space-y-2 text-sm">
                <span>Course topic</span>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-cyan-400"
                  placeholder="e.g. Java Inheritance"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span>Student level</span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span>Session duration (minutes)</span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
                >
                  Save configuration
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-lg border border-dashed border-slate-700 p-4">
              <p className="font-medium">Current configuration</p>
              <p className="mt-2 text-sm text-slate-400">
                {topic || "No topic"} · {level} · {duration} minutes
              </p>
              <p className="mt-3 text-xs text-amber-300">
                Phase 1: Configuration preview only. AI generation,
                verification and exports are not implemented yet.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
