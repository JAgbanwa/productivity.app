# Momentum — Build Week submission kit

## One-line pitch

Momentum turns any ambitious goal into a deadline-aware daily system, tracks the evidence like a GitHub contribution graph, and uses GPT‑5.6 to adapt the plan when real life gets in the way.

## The problem

Goal trackers record what people wish would happen. They rarely solve the harder problem: deciding what to do today, what progression fits the deadline, and how to restart after missing a few days. Users are left with a beautifully stored intention and the same decision fatigue they began with.

## The solution

Momentum asks for the outcome and real constraints, lets the user choose a domain-specific path, then builds a three-phase roadmap and today’s exact checklist. Every completed task becomes visible evidence. When the system stops fitting, the context-aware coach can reduce the load, preserve the direction, and explain the next best action without shame or fake certainty.

## Why it is different

1. **AI is useful, not decorative.** GPT‑5.6 receives the real goal, phase, constraints, tasks, and measured progress. Its structured response can drive only a small allowlist of safe product actions.
2. **The demo never depends on AI uptime.** A deterministic domain engine produces the full product experience locally; AI improves judgment and adaptation.
3. **It closes the execution loop.** Goal → method → roadmap → today → evidence → adaptation all live in one product.
4. **It respects setbacks.** Missed days become evidence that the plan needs adjustment, not an invitation to double the workload or shame the user.
5. **It is private by default.** Core data stays on-device. Only the context needed for a coach message is sent to the same-origin endpoint, and OpenAI requests use `store: false`.

## Judging criteria map

### Technical implementation

- Pure, testable planning engine separated from the UI;
- stable task evidence model and legacy-data migration;
- Responses API with GPT‑5.6, Structured Outputs, refusal handling, bounded input, timeout, and graceful fallback;
- schema-constrained action allowlist;
- automated coverage for plan, tracking, adaptation, safety, and API contracts.

### Design and user experience

- High-contrast responsive interface with an intentional product narrative;
- three-step progressive-disclosure onboarding;
- one-action focus state and domain-specific method cards;
- contribution-style calendar with partial/full completion;
- interactive seeded demo for a zero-friction judge experience;
- keyboard focus, semantic controls, reduced-motion handling, and mobile navigation.

### Potential impact

The product can support health routines, skill acquisition, creative work, career development, finances, wellbeing, and custom outcomes. Its central insight—that the size of the system should adapt before the goal is abandoned—applies broadly to long-term personal change.

### Quality of the idea

Momentum is not another chatbot beside a checklist. It treats a goal as an evolving system with constraints, evidence, phases, and safe actions. AI is grounded in that system and can modify it through explicit product affordances.

## 90-second demo storyboard

### 0:00–0:12 — The promise

Show the landing page.

> “Most goal apps save an intention. Momentum designs the system that makes the intention executable.”

### 0:12–0:32 — Turn an ambition into a system

Click **Build my system**. Enter “Hold a confident conversation in Spanish,” choose **Learning**, select **Project-first**, five days per week, and 30 minutes. Show the generated three-phase roadmap.

> “The path changes with the goal. Momentum works backward from the deadline and the time I can genuinely protect.”

### 0:32–0:51 — Do today, not someday

Open **Today**. Complete the recall and applied-practice tasks. Return to the overview and show the progress update.

> “Every action has a reason, a duration, and a visible result. Partial work remains visible rather than being flattened into a failed day.”

### 0:51–1:10 — Adapt with GPT‑5.6

Open **AI Coach**, choose the goal, and send “I missed three days and only have 15 minutes this week.” Click **Lighten my system** on the structured response.

> “GPT‑5.6 is grounded in my actual plan and evidence. It can suggest only safe, product-level actions. Here it reduces the session while preserving the deadline and direction.”

### 1:10–1:25 — Prove the change

Open the goal. Show the calendar, phased roadmap, streaks, task rate, and new session duration.

> “The plan changed, the history did not. Momentum helps me restart without pretending the missed days never happened.”

### 1:25–1:30 — Close

Return to the landing headline.

> “Build the system. Become the person. One provable day at a time.”

## Suggested screenshots

1. Landing page with product preview and floating coach card;
2. path-selection step showing gym/calisthenics/hybrid or learning paths;
3. generated three-phase roadmap;
4. Today checklist at partial completion;
5. AI Coach response with clickable actions;
6. goal detail with contribution calendar and milestones.

## Submission checklist

- [ ] Deploy the full version to Vercel with `OPENAI_API_KEY` configured.
- [ ] Verify `/api/coach` from the deployed origin.
- [ ] Record the 90-second demo at desktop width.
- [ ] Add the public demo URL and repository URL to the submission.
- [ ] Include the project description and responsible-guidance note.
- [ ] Confirm no API key or private `.env` file is committed.
