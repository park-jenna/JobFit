"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24 font-sans">
      {/* Hero */}
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-amber-50 p-10 shadow-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          JobFit
        </p>

        <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
          See how well your resume
          <br />
          <span className="underline decoration-amber-300 decoration-[6px] underline-offset-4">
            actually matches
          </span>{" "}
          the job.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          Upload your resume, paste a job description, and get a blended match
          score using skill matching + semantic embeddings — plus actionable
          gaps.
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            href="/analyze"
            className="rounded-2xl bg-slate-500 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Start analysis →
          </Link>

          <Link
            href="/result"
            className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            View sample result
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border px-3 py-1">Skill match</span>
          <span className="rounded-full border px-3 py-1">
            Semantic similarity
          </span>
          <span className="rounded-full border px-3 py-1">AI summary</span>
          <span className="rounded-full border px-3 py-1">
            Missing skills
          </span>
        </div>
      </section>

      {/* Value props */}
      <section className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border p-6">
          <p className="font-semibold text-slate-400">Blended scoring</p>
          <p className="mt-2 text-sm text-slate-500">
            Keyword matching + embeddings, not just ATS-style checks.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <p className="font-semibold text-slate-400">Skill gaps</p>
          <p className="mt-2 text-sm text-slate-500">
            Required vs preferred gaps clearly separated.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <p className="font-semibold text-slate-400">Actionable insight</p>
          <p className="mt-2 text-sm text-slate-500">
            AI-generated strengths, gaps, and overall fit summary.
          </p>
        </div>
      </section>
    </main>
  );
}