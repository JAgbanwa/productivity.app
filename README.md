# Momentum ✦

> You do not need more motivation. You need a system.

- **Website name:** Momentum
- **Local website:** [http://localhost:8080](http://localhost:8080)
- **Repository:** [JAgbanwa/productivity.app](https://github.com/JAgbanwa/productivity.app)

Momentum is a local-first goal operating system that turns an ambition into a path, a phased roadmap, and a checklist for today. It was redesigned for the **OpenAI Build Week Challenge** from the original Streaks accountability tracker.

The product is built around one loop:

**Name the outcome → choose a sustainable path → follow today → review visible proof → adapt without shame.**

## Why it exists

Most goal products capture an intention and leave the difficult planning work to the user. A goal such as “build a stronger body” or “learn Spanish” is not actionable until someone decides:

- which approach fits the person;
- what progression is realistic before the deadline;
- what to do today;
- how to recover after missed days; and
- what evidence will count as progress.

Momentum makes those decisions explicit. The user chooses the constraints; the product designs a system around them.

## What is included

### Goal-to-system onboarding

The three-step designer captures the outcome, life area, start date, deadline, current level, weekly cadence, session duration, constraints, and preferred path.

Paths change with the domain. Examples include:

- Fitness: gym strength, calisthenics, or hybrid;
- Learning: structured curriculum, project-first, or deliberate practice;
- Career: portfolio sprint, skill stack, or network and ship;
- Creative work: daily craft, project sprint, or publish loop;
- Wellbeing, finance, and custom milestone systems.

### Deterministic planning engine

The local engine immediately produces a complete usable plan without signup, network access, or an API key. It creates:

- a three-phase deadline-aware roadmap;
- domain-specific daily work and recovery tasks;
- stable task identifiers for long-term tracking;
- realistic session time allocation;
- a concrete success metric; and
- safe, non-diagnostic fitness guidance.

### GPT-5.6 Momentum Coach

When `OPENAI_API_KEY` is configured, the same-origin `/api/coach` endpoint uses the OpenAI Responses API to:

- refine the baseline roadmap while preserving the user’s constraints;
- answer questions using the selected goal, current phase, real checklist state, and progress statistics;
- suggest the smallest useful restart after a disruption;
- return schema-constrained product actions such as **Open today** or **Rebalance**; and
- avoid inventing completed work or guaranteeing outcomes.

The API key stays on the server. Requests use `store: false`, bounded inputs, a 25-second timeout, and Structured Outputs. If the endpoint is missing or unavailable, the product quietly uses its context-aware offline coach.

### Daily execution and visible proof

- A single “next best action” on the overview;
- task-level checklists with duration and purpose;
- automatic active and recovery days;
- GitHub-style practice calendars with partial and complete states;
- clickable past/today squares for quick backfilling;
- current and best streaks, proof days, task completion, and timeline progress;
- adaptive session reduction that keeps the deadline and direction intact.

### Product details judges can try immediately

- **Explore a demo** seeds two realistic systems and progress histories.
- All demo interactions are real and saved locally.
- Existing `streaks_v2_*` local data is migrated automatically.
- The UI is responsive, keyboard accessible, reduced-motion aware, and usable at mobile sizes.

## Architecture

```text
Browser
├── app.js                 product state, navigation, views, interaction
├── planner.js             pure local planning + coaching engine
├── localStorage           goals, evidence, coach history
└── POST /api/coach        optional same-origin AI enhancement
       └── Responses API   GPT-5.6 + Structured Outputs
```

The deterministic engine is the product baseline, not a mock. GPT-5.6 adds judgment and adaptation where generative reasoning is valuable. This hybrid design keeps the first-run experience instant and makes AI failure graceful rather than catastrophic.

## Run locally

The core app has zero runtime dependencies:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Run validation:

```bash
npm test
npm run check
```

## Enable the AI coach

Deploy to Vercel and configure the server-side environment variable:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6   # optional; this is the current default
```

`api/coach.js` is a Vercel-compatible serverless function. The static product still works on GitHub Pages in offline-coach mode.

Never place an OpenAI API key in browser code or commit a real `.env` file. See `.env.example` for the expected variables.

## Responsible guidance

Momentum is designed for planning and education, not medical diagnosis, treatment, financial advice, or guaranteed transformation. Fitness plans use general progression and recovery principles, tell users not to work through pain, and direct health concerns to qualified professionals. The coach treats missed days as planning evidence rather than a moral failure.

## Tests

The Node test suite covers:

- deadline-to-phase plan generation;
- domain-specific active/recovery task generation;
- partial-day, full-day, and streak calculations;
- plan rebalancing invariants;
- offline restart coaching and fitness safety language;
- private Responses API configuration and output extraction;
- the allowlist of AI-triggerable product actions.

## Build Week submission material

See [SUBMISSION.md](./SUBMISSION.md) for a concise project description, differentiators, judging-criteria map, and a 90-second demo storyboard.

---

Built with Codex for OpenAI Build Week. The original Streaks concept remains at the heart of Momentum: make the promise visible, then keep it one day at a time.
