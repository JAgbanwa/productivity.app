# Streaks ✦ — Follow Through

> A personal accountability tracker for people who break promises to themselves.

**Live app → [streaks.jamal.app](https://jagbanwa.github.io/productivity.app)**

---

## What it is

Streaks is a single-file web app (no backend, no account required) that helps you:

- **Define long-term goals** with a start date, deadline, priority level, category, and daily commitment
- **Track daily follow-through** using a GitHub-style commit calendar — every day you show up, you get a ✓ tick on the grid
- **See streaks compound** — current streak, best streak, and overall completion rate, all calculated from your ticks
- **Plan each day** — a prioritised daily plan view shows your goals sorted High → Medium → Low with actionable micro-steps for each
- **Stay honest** — missed days show up in rose-red, done days in sage-green; the calendar doesn't lie

It's inspired by Jerry Seinfeld's "don't break the chain" method and GitHub's contribution calendar.

---

## Features

| Feature | Description |
|---|---|
| **Goal calendar** | A full date-range grid (like GitHub commits) for each goal. Click today's cell or the card button to tick a day |
| **Priority system** | High 🔴 / Medium 🟡 / Low 🟢 — goals are sorted by priority throughout the app |
| **Streak tracking** | Current streak, best streak, total days hit, and completion % per goal and globally |
| **Today's Plan** | A single-page view showing every active goal's daily commitment, grouped by priority |
| **Micro-step breakdown** | Each goal has user-defined or auto-generated daily action steps |
| **Progress to deadline** | A visual bar showing how far through the goal's timeframe you are |
| **Persistent storage** | Everything is saved in `localStorage` — no signup needed, works offline |
| **Responsive** | Mobile-friendly layout down to 375px |

---

## How to use

1. Open the app
2. Click **New Goal** and fill in:
   - A title ("Write 500 words daily")
   - Why it matters (optional but recommended)
   - Category, priority, start date, deadline
   - What "done" looks like each day ("500 words written")
   - Optional micro-steps (one per line)
3. From the dashboard, hit **Tick today** on each goal you complete
4. Click a goal card to see its full calendar and progress stats
5. Use **Today's Plan** for a focused, prioritised task view each morning

---

## Tech stack

- Pure HTML + CSS + Vanilla JS — zero dependencies, zero build step
- `localStorage` for persistence
- Google Fonts (Instrument Serif + DM Sans + DM Mono) for typography
- Fully static — works from any CDN or file system

---

## Running locally

```bash
git clone https://github.com/JAgbanwa/productivity.app.git
cd productivity.app
# Open index.html in any browser — no server needed
open index.html
```

Or serve with Python:

```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

---

## Deploying

This app is deployed via **GitHub Pages** from the `main` branch root.

To deploy your own fork:
1. Fork the repository
2. Go to **Settings → Pages**
3. Set source to `Deploy from branch` → `main` → `/ (root)`
4. Visit `https://<your-username>.github.io/productivity.app`

---

## Design

- **Palette**: near-black ink (`#0e0e0f`) with amber accent (`#e8a844`), sage green for success, rose for missed days
- **Type**: Instrument Serif (display) + DM Sans (body) + DM Mono (data/numbers)
- **Signature element**: The life-calendar grid — every day of your goal rendered as a small cell with a tactile ✓ tick for completed days

---

## Roadmap ideas

- [ ] Export progress as PNG / PDF
- [ ] Goal templates (habits, fitness plans, writing schedules)
- [ ] Optional reminders via browser notifications
- [ ] Dark/light mode toggle
- [ ] Cloud sync via a simple backend

---

MIT License — built with intent for anyone who needs to follow through.
