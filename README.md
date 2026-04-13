# JobFit — Semantic Job Description & Resume Matching

**Personal project.** A semantic matching tool that helps early-career candidates see how well their resume aligns with a technical job description and what to improve.

**Live demo:** [→ Open app](https://jobfit-web.vercel.app/) 

JobFit is optimized for **technical roles** (e.g. engineering, product, data) and **entry-level positions** (internships, new grad, early career). It is not designed for senior or highly experienced roles.

Instead of keyword overlap alone, JobFit combines semantic similarity (embeddings), skill-level matching, and LLM-generated summaries to surface interpretable strengths and gaps.

---

## Scope

- **For:** Technical job descriptions; entry-level applicants (interns, new grads, early career).
- **Not for:** Senior-level roles or long career timelines; non-technical JDs.

---

## Core Ideas & Design Decisions

### 1. Semantic similarity beyond keywords

- Computes embeddings (OpenAI `text-embedding-3-small`) for the full job description and resume.
- Uses cosine similarity and normalizes to a 0–100 semantic score.
- Captures conceptual alignment even when wording differs (e.g. JD: “React required” vs resume: “Built SPAs with modern frontend frameworks”).

### 2. Skill matching as a separate, interpretable signal

- **Job description:** LLM extracts **required** and **preferred** skills, optional **“any-of”** groups, and an **importance** per skill (see below).
- **Resume:** LLM extracts **tools** (languages, frameworks, etc.) and **concepts** (supported, job-relevant ideas). Those lists are normalized and compared to the JD.
- Coverage scoring uses **90% weight on required** vs **10% on preferred** (within the skill signal).

### 3. Importance weighting for JD skills

- Not all JD skills are equally important. Each skill gets an **importance in [0.1, 1.0]** from the JD parser, using cues like “must” / “required” / “preferred”, position, and frequency.
- A separate **importance-weighted** score rewards matching high-importance JD skills. That score is blended with the coverage score when building the final match (see §4).

### 4. Weighted scoring instead of a single number

- **Semantic score** (0–100): embedding-based conceptual alignment.
- **Coverage skill score** (0–100): required/preferred coverage (90/10 split between those two buckets), including “any-of” groups. This is what the API exposes as **`skillScore`** and what the result page shows as the skill number.
- **Inside the pipeline only:** the skill dimension that feeds **match score** is **50% coverage skill score + 50% importance-weighted score**.
- **Final match score** (0–100): **50% semantic + 50%** that blended skill dimension.
- Multiple signals keep the result interpretable and tunable.

### 5. Structured LLM summary

- In the same `/api/analyze` request, an LLM returns **strengths**, **gaps**, and a short **overall fit** line (JSON-shaped for the UI).
- The summary runs after the scoring pipeline succeeds. It uses the JD and resume text only, while numeric scoring remains separate and deterministic.

---

## Current Features

- Semantic similarity using OpenAI `text-embedding-3-small`
- JD skill extraction: required / preferred, “any-of” groups, per-skill importance
- Resume skill extraction: `tools` and `concepts` lists
- Coverage skill score + importance-weighted skill signal → combined **match score** (50% semantic / 50% blended skill)
- AI-generated summary (strengths, gaps, overall fit)
- PDF resume ingestion
- Modular backend (embeddings, similarity, scoring, analyzers, summary)

---

## Tech Stack

- **Next.js** (App Router)
- **TypeScript**
- **OpenAI API**
  - `text-embedding-3-small` for semantic similarity
  - GPT (`gpt-4o-mini` in code) for JD/resume parsing, importance on the JD, and summaries
- **Tailwind CSS**
- **pdf-parse** for resume PDF → text

---

## Privacy Note

Uploaded resume text and pasted job descriptions are sent to OpenAI for analysis. Results are stored only in the browser session via `sessionStorage`; JobFit does not currently persist analyses or create shareable reports.

---

## Project Structure

```
src/
├── app/
│   ├── api/analyze/route.ts    # End-to-end analysis pipeline
│   ├── analyze/                # JD + resume input UI
│   ├── result/                 # Result visualization UI
│   ├── sample/                 # Loads a demo result into sessionStorage
│   ├── layout.tsx, page.tsx, globals.css
├── lib/
│   ├── embeddings.ts           # OpenAI embedding helpers
│   ├── llmJson.ts              # Shared JSON parsing for LLM responses
│   ├── similarity.ts           # Cosine similarity, 0–100 normalization
│   └── weightedScore.ts        # Scoring & required/preferred weighting
├── services/
│   ├── openaiClient.ts         # OpenAI client
│   ├── jdAnalyzer.ts           # JD skill + importance extraction (LLM)
│   ├── resumeAnalyzer.ts       # Resume tools/concepts (LLM)
│   └── summary.ts              # Strengths / gaps / overall fit (LLM)
```

---

## Run Locally

1. Clone and install:
   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_key_here
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Analyze:** Upload a resume (PDF) and paste a technical job description on `/analyze`; view results on `/result`. Results are kept in session only (no persistence yet). **`/sample`** can seed the result page with demo data for UI checks.

5. Run checks:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

---

## To Be Added

- Gap severity ranking
- Resume tailoring recommendations
- Interactive skill coverage visualizations
- Result persistence / shareable links (v1.5)
- (Optional) Caching embeddings for faster re-runs
