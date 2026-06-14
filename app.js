/* ============================================================
   STREAKS — Application Logic
   Storage: localStorage  |  No external dependencies
   ============================================================ */

'use strict';

// ---- State ---------------------------------------------------
const STORAGE_KEY = 'streaks_goals_v1';
const CHECKS_KEY  = 'streaks_checks_v1';

let goals   = [];    // Array<Goal>
let checks  = {};    // { "goalId:YYYY-MM-DD": true }
let editingId = null;
let selectedPriority = 'High';
let currentDetailId  = null;

/* Goal shape:
  {
    id: string,
    name: string,
    description: string,
    category: string,
    priority: 'High'|'Medium'|'Low',
    startDate: 'YYYY-MM-DD',
    endDate: 'YYYY-MM-DD',
    dailyCommitment: string,
    steps: string[],
    createdAt: number
  }
*/

// ---- Helpers -------------------------------------------------
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function daysBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  return Math.round((db - da) / 86400000);
}

function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.classList.remove('show'); }, 3000);
}

// ---- Persistence ---------------------------------------------
function saveGoals() { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); }
function saveChecks() { localStorage.setItem(CHECKS_KEY, JSON.stringify(checks)); }

function loadData() {
  try { goals  = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { goals  = []; }
  try { checks = JSON.parse(localStorage.getItem(CHECKS_KEY))  || {}; } catch { checks = {}; }
}

// ---- Check / Tick --------------------------------------------
function checkKey(goalId, date) { return `${goalId}:${date}`; }
function isChecked(goalId, date) { return !!checks[checkKey(goalId, date)]; }

function toggleCheck(goalId, date) {
  const key = checkKey(goalId, date);
  if (checks[key]) {
    delete checks[key];
  } else {
    checks[key] = true;
  }
  saveChecks();
  refreshDashboard();
  if (currentDetailId === goalId) renderDetailCalendar(goalId);
  updateStats();
}

// ---- Streak calc ---------------------------------------------
function streakInfo(goalId) {
  const g = goals.find(x => x.id === goalId);
  if (!g) return { current: 0, best: 0, total: 0, rate: 0 };

  const t = today();
  const start = g.startDate <= t ? g.startDate : t;
  const end   = g.endDate   <  t ? g.endDate   : t;

  let all = [], cur = 0, best = 0, total = 0;
  let d = start;
  while (d <= end) {
    const hit = isChecked(goalId, d);
    if (hit) { total++; cur++; } else { cur = 0; }
    best = Math.max(best, cur);
    all.push({ date: d, hit });
    d = addDays(d, 1);
  }

  // Current streak = consecutive days going backwards from today
  let cs = 0;
  let dd = t;
  while (dd >= start) {
    if (isChecked(goalId, dd)) { cs++; } else { break; }
    dd = addDays(dd, -1);
  }

  const totalDays = Math.max(1, daysBetween(start, end) + 1);
  return { current: cs, best, total, rate: Math.round((total / totalDays) * 100) };
}

// ---- Global stats -------------------------------------------
function updateStats() {
  const t = today();
  const active = goals.filter(g => g.endDate >= t);
  $('total-goals').textContent = active.length;

  let hitToday = 0, bestAll = 0;
  let totalHit = 0, totalPossible = 0;

  goals.forEach(g => {
    if (isChecked(g.id, t)) hitToday++;
    const { current, best, total, rate } = streakInfo(g.id);
    bestAll = Math.max(bestAll, best);

    const start = g.startDate <= t ? g.startDate : t;
    const end   = g.endDate   <  t ? g.endDate   : t;
    if (end >= start) {
      totalPossible += daysBetween(start, end) + 1;
      totalHit      += total;
    }
  });

  $('streak-today').textContent = hitToday;
  $('best-streak').textContent  = bestAll;
  $('completion-rate').textContent = totalPossible
    ? Math.round((totalHit / totalPossible) * 100) + '%'
    : '0%';
}

// ---- Screens -------------------------------------------------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(name).classList.add('active');
  if (name === 'dashboard') refreshDashboard();
  if (name === 'today')     renderToday();
}

// ---- Dashboard ----------------------------------------------
function refreshDashboard() {
  const t = today();
  $('goals-date-label').textContent = fmtDate(t);
  updateStats();

  const container = $('goals-container');
  const emptyState = $('empty-state');

  // clear existing cards (not empty-state)
  container.querySelectorAll('.goal-card').forEach(c => c.remove());

  if (goals.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  // Sort: High > Medium > Low, then by endDate
  const priority = { High: 0, Medium: 1, Low: 2 };
  const sorted = [...goals].sort((a, b) =>
    priority[a.priority] - priority[b.priority] ||
    a.endDate.localeCompare(b.endDate)
  );

  sorted.forEach(g => {
    const card = buildGoalCard(g, t);
    container.insertBefore(card, emptyState);
  });
}

function buildGoalCard(g, t) {
  const card = document.createElement('div');
  card.className = 'goal-card';
  card.setAttribute('data-id', g.id);

  const { current, best, total } = streakInfo(g.id);
  const checked = isChecked(g.id, t);
  const active  = g.endDate >= t;

  // Last 14 days strip
  const strip = buildMiniStrip(g, t, 14);

  const daysLeft = daysBetween(t, g.endDate);
  const deadlineLabel = g.endDate < t
    ? '<span style="color:var(--muted)">Ended</span>'
    : daysLeft === 0
    ? '<span style="color:var(--amber)">Last day!</span>'
    : `${daysLeft}d left`;

  card.innerHTML = `
    <div class="goal-card-left">
      <div class="goal-card-top">
        <span class="priority-badge ${g.priority}">${g.priority}</span>
        <span class="goal-title">${esc(g.name)}</span>
      </div>
      <div class="goal-meta">
        <span>${esc(g.category)}</span>
        <span>${fmtDate(g.startDate)} → ${fmtDate(g.endDate)}</span>
        <span>${deadlineLabel}</span>
        <span style="color:var(--sage)">🔥 ${current}-day streak</span>
      </div>
    </div>
    <div class="goal-card-right">
      <div class="mini-strip" id="strip-${g.id}"></div>
      ${active ? `<button class="tick-btn ${checked ? 'ticked' : ''}" onclick="event.stopPropagation(); toggleCheck('${g.id}','${t}')">
        ${checked ? '✓ Done today' : 'Tick today'}
      </button>` : '<span style="font-size:0.75rem;color:var(--muted)">Completed</span>'}
    </div>
  `;

  card.querySelector('.goal-card-left').addEventListener('click', () => openDetail(g.id));

  // populate mini strip
  const stripEl = card.querySelector(`#strip-${g.id}`);
  strip.forEach(cell => stripEl.appendChild(cell));

  return card;
}

function buildMiniStrip(g, t, n) {
  const cells = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(t, -i);
    const cell = document.createElement('div');
    cell.className = 'mini-cell';
    if (d > t) cell.classList.add('future');
    else if (d < g.startDate || d > g.endDate) cell.classList.add('future');
    else if (isChecked(g.id, d)) cell.classList.add('done');
    else if (d < t) cell.classList.add('missed');
    if (d === t) cell.classList.add('today');
    cells.push(cell);
  }
  return cells;
}

// ---- Today's Plan -------------------------------------------
function renderToday() {
  const t = today();
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  $('today-date-label').textContent = dateLabel;

  const active = goals.filter(g => g.startDate <= t && g.endDate >= t);
  const sorted = [...active].sort((a, b) => {
    const p = { High: 0, Medium: 1, Low: 2 };
    return p[a.priority] - p[b.priority];
  });

  const container = $('today-tasks');
  container.innerHTML = '';

  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✦</div><div class="empty-title">No active goals today.</div><div class="empty-sub">Add a goal from the dashboard first.</div></div>`;
    $('today-progress-text').textContent = '0 / 0';
    return;
  }

  let doneCount = 0;
  const groups = { High: [], Medium: [], Low: [] };
  sorted.forEach(g => groups[g.priority].push(g));

  ['High', 'Medium', 'Low'].forEach(priority => {
    const gs = groups[priority];
    if (gs.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'today-task-group';

    const labelEl = document.createElement('div');
    labelEl.className = 'today-task-group-label';
    const emoji = priority === 'High' ? '🔴' : priority === 'Medium' ? '🟡' : '🟢';
    labelEl.textContent = `${emoji} ${priority} Priority`;
    groupEl.appendChild(labelEl);

    gs.forEach(g => {
      const checked = isChecked(g.id, t);
      if (checked) doneCount++;

      // Each goal = daily commitment + micro-steps
      const mainItem = buildTodayItem(g, null, checked, t);
      groupEl.appendChild(mainItem);

      // Micro-steps (sub-tasks)
      (g.steps || []).forEach((step, i) => {
        const stepKey = `step_${g.id}_${i}`;
        const stepChecked = !!checks[`${stepKey}:${t}`];
        const stepEl = buildTodayItem(g, step, stepChecked, t, stepKey);
        stepEl.style.marginLeft = '1.5rem';
        stepEl.style.borderColor = 'transparent';
        stepEl.style.background = 'transparent';
        stepEl.style.paddingTop = '0.5rem';
        stepEl.style.paddingBottom = '0.5rem';
        groupEl.appendChild(stepEl);
      });
    });

    container.appendChild(groupEl);
  });

  $('today-progress-text').textContent = `${doneCount} / ${sorted.length}`;
}

function buildTodayItem(g, stepText, checked, t, stepKey) {
  const el = document.createElement('div');
  el.className = 'today-task-item' + (checked ? ' completed' : '');
  el.setAttribute('data-goalid', g.id);

  const id = stepKey || g.id;
  const label = stepText || g.dailyCommitment || g.name;
  const goalLabel = stepText ? '' : '';

  el.innerHTML = `
    <button class="tti-check ${checked ? 'checked' : ''}" onclick="toggleTodayCheck('${id}', '${t}', this)">
      ${checked ? '✓' : ''}
    </button>
    <div class="tti-content">
      ${!stepText ? `<div class="tti-goal">${esc(g.name)}</div>` : ''}
      <div class="tti-name">${esc(label)}</div>
    </div>
  `;
  return el;
}

function toggleTodayCheck(id, date, btn) {
  const key = checkKey(id, date);
  if (checks[key]) {
    delete checks[key];
    btn.classList.remove('checked');
    btn.textContent = '';
    btn.closest('.today-task-item').classList.remove('completed');
  } else {
    checks[key] = true;
    btn.classList.add('checked');
    btn.textContent = '✓';
    btn.closest('.today-task-item').classList.add('completed');
  }
  saveChecks();

  // Re-tally progress
  const t = today();
  const active = goals.filter(g => g.startDate <= t && g.endDate >= t);
  let doneCount = active.filter(g => isChecked(g.id, t)).length;
  $('today-progress-text').textContent = `${doneCount} / ${active.length}`;

  updateStats();
}

// ---- Goal Detail --------------------------------------------
function openDetail(goalId) {
  const g = goals.find(x => x.id === goalId);
  if (!g) return;
  currentDetailId = goalId;

  $('detail-title').textContent = g.name;
  $('detail-description').textContent = g.description || 'No description provided.';
  $('detail-category').textContent = g.category;

  const pb = $('detail-priority-badge');
  pb.textContent = g.priority;
  pb.className = `detail-priority-badge ${g.priority}`;

  // Stats
  const { current, best, total, rate } = streakInfo(goalId);
  $('ds-streak').textContent = current;
  $('ds-best').textContent   = best;
  $('ds-total').textContent  = total;
  $('ds-rate').textContent   = rate + '%';

  // Deadline bar
  const t = today();
  const totalSpan = Math.max(1, daysBetween(g.startDate, g.endDate));
  const elapsed   = clamp(daysBetween(g.startDate, t), 0, totalSpan);
  const pct       = Math.round((elapsed / totalSpan) * 100);
  $('deadline-bar-fill').style.width = pct + '%';
  const dLeft = daysBetween(t, g.endDate);
  $('deadline-days-left').textContent = g.endDate < t ? 'Ended' : dLeft === 0 ? 'Last day!' : `${dLeft} days left`;

  // Calendar
  renderDetailCalendar(goalId);

  // Daily breakdown
  renderBreakdown(g);

  // Delete button
  $('delete-goal-btn').onclick = () => deleteGoal(goalId);

  showScreen('goal-detail');
}

function renderDetailCalendar(goalId) {
  const g = goals.find(x => x.id === goalId);
  if (!g) return;

  const container = $('calendar-grid');
  container.innerHTML = '';

  const t       = today();
  const start   = g.startDate;
  const end     = g.endDate;
  const total   = daysBetween(start, end) + 1;

  // Build all day cells
  for (let i = 0; i < total; i++) {
    const d    = addDays(start, i);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.setAttribute('data-tooltip', fmtDate(d));

    if (d === t) {
      cell.classList.add('today-cell');
      if (isChecked(goalId, d)) cell.classList.add('done');
      cell.addEventListener('click', () => {
        toggleCheck(goalId, d);
      });
    } else if (d < t) {
      cell.classList.add(isChecked(goalId, d) ? 'done' : 'missed');
    } else {
      cell.classList.add('future');
    }

    container.appendChild(cell);
  }
}

function renderBreakdown(g) {
  const container = $('breakdown-tasks');
  container.innerHTML = '';

  const steps = g.steps && g.steps.length > 0
    ? g.steps
    : generateDefaultSteps(g);

  steps.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'breakdown-task';
    el.innerHTML = `<span class="breakdown-num">${String(i + 1).padStart(2, '0')}.</span><span class="breakdown-text">${esc(s)}</span>`;
    container.appendChild(el);
  });
}

function generateDefaultSteps(g) {
  const name = g.name.toLowerCase();
  const cat  = g.category;

  if (cat === 'Health') return [
    'Set out workout clothes the night before',
    'Start with a 5-minute warm-up to build momentum',
    'Complete your main activity at your chosen intensity',
    'Cool down and stretch for 5 minutes',
    'Log your session — time, how it felt, notes'
  ];
  if (cat === 'Creative') return [
    'Open your workspace — no distractions, timer ready',
    'Read the last paragraph / bar / sketch you left off at',
    'Set a 25-minute focused creation block (Pomodoro)',
    'Rest 5 minutes, then decide: done or another block?',
    'Save your progress and note tomorrow\'s starting point'
  ];
  if (cat === 'Learning') return [
    'Review yesterday\'s notes for 5 minutes (spaced repetition)',
    'Read or watch for 30 focused minutes — take brief notes',
    'Write a 3-sentence summary of what you learned',
    'Do one practice problem or apply one concept',
    'Update your learning log with today\'s topic and source'
  ];
  if (cat === 'Finance') return [
    'Check your account balance and spending since yesterday',
    'Log any purchases in your budget tracker',
    'Take one action towards your financial goal (save, invest, research)',
    'Review if you\'re on track for the week',
    'Note one thing you did well and one to improve'
  ];
  return [
    `Clarify what "done" means for today's "${g.dailyCommitment || g.name}"`,
    'Block out time in your calendar and protect it',
    'Work in a focused burst — remove distractions',
    'Evaluate: did you complete the commitment?',
    'Mark yourself done and note any blockers for tomorrow'
  ];
}

// ---- Delete goal -------------------------------------------
function deleteGoal(goalId) {
  if (!confirm('Delete this goal? This cannot be undone.')) return;
  goals = goals.filter(g => g.id !== goalId);
  // remove associated checks
  Object.keys(checks).forEach(k => {
    if (k.startsWith(goalId + ':')) delete checks[k];
  });
  saveGoals();
  saveChecks();
  showToast('Goal deleted.', 'error');
  showScreen('dashboard');
}

// ---- Add / Edit Modal ---------------------------------------
function openAddGoal() {
  editingId = null;
  selectedPriority = 'High';
  $('modal-title').textContent = 'New Goal';
  $('goal-name').value = '';
  $('goal-desc').value = '';
  $('goal-category').value = 'Health';
  $('goal-daily').value = '';
  $('goal-steps').value = '';
  $('goal-start').value = today();
  $('goal-end').value   = addDays(today(), 30);
  updatePriorityUI();
  $('modal-overlay').classList.add('open');
  $('goal-name').focus();
}

function closeModal(e) {
  if (e && e.target !== $('modal-overlay')) return;
  $('modal-overlay').classList.remove('open');
}

function selectPriority(val) {
  selectedPriority = val;
  updatePriorityUI();
}

function updatePriorityUI() {
  document.querySelectorAll('.priority-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.val === selectedPriority);
  });
}

function saveGoal() {
  const name  = $('goal-name').value.trim();
  const start = $('goal-start').value;
  const end   = $('goal-end').value;

  if (!name)  { showToast('Please enter a goal title.', 'error'); return; }
  if (!start) { showToast('Please set a start date.', 'error');   return; }
  if (!end)   { showToast('Please set a deadline.', 'error');     return; }
  if (end < start) { showToast('Deadline must be after start date.', 'error'); return; }

  const steps = $('goal-steps').value.trim()
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const goal = {
    id: editingId || uid(),
    name,
    description:     $('goal-desc').value.trim(),
    category:        $('goal-category').value,
    priority:        selectedPriority,
    startDate:       start,
    endDate:         end,
    dailyCommitment: $('goal-daily').value.trim(),
    steps,
    createdAt: editingId
      ? (goals.find(g => g.id === editingId)?.createdAt || Date.now())
      : Date.now()
  };

  if (editingId) {
    goals = goals.map(g => g.id === editingId ? goal : g);
  } else {
    goals.push(goal);
  }

  saveGoals();
  $('modal-overlay').classList.remove('open');
  showToast(editingId ? 'Goal updated!' : 'Goal added! Now show up for it. ✦', 'success');
  refreshDashboard();
}

// ---- Escape HTML --------------------------------------------
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Keyboard shortcuts ------------------------------------
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $('modal-overlay').classList.remove('open');
});

// ---- Init --------------------------------------------------
loadData();

// Show landing only if no goals yet; otherwise go straight to dashboard
if (goals.length === 0) {
  showScreen('landing');
} else {
  showScreen('dashboard');
}
