/* ============================================================
   STREAKS — Application Logic
   Storage: localStorage  |  No external dependencies
   ============================================================ */

'use strict';

// ---- State ---------------------------------------------------
const STORAGE_KEY = 'streaks_goals_v1';
const CHECKS_KEY  = 'streaks_checks_v1';

let goals   = [];
let checks  = {};
let editingId = null;
let selectedPriority = 'High';
let currentDetailId  = null;

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

function showToast(msg, type) {
  type = type || '';
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

// ---- Persistence ---------------------------------------------
function saveGoals() { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); }
function saveChecks() { localStorage.setItem(CHECKS_KEY, JSON.stringify(checks)); }

function loadData() {
  try { goals  = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) { goals  = []; }
  try { checks = JSON.parse(localStorage.getItem(CHECKS_KEY))  || {}; } catch(e) { checks = {}; }
}

// ---- Check / Tick --------------------------------------------
function checkKey(goalId, date) { return goalId + ':' + date; }
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
  const g = goals.find(function(x) { return x.id === goalId; });
  if (!g) return { current: 0, best: 0, total: 0, rate: 0 };

  const t = today();
  const start = g.startDate <= t ? g.startDate : t;
  const end   = g.endDate   <  t ? g.endDate   : t;

  let cur = 0, best = 0, total = 0;
  let d = start;
  while (d <= end) {
    const hit = isChecked(goalId, d);
    if (hit) { total++; cur++; } else { cur = 0; }
    best = Math.max(best, cur);
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
  return { current: cs, best: best, total: total, rate: Math.round((total / totalDays) * 100) };
}

// ---- Global stats -------------------------------------------
function updateStats() {
  const t = today();
  const active = goals.filter(function(g) { return g.endDate >= t; });
  $('total-goals').textContent = active.length;

  let hitToday = 0, bestAll = 0;
  let totalHit = 0, totalPossible = 0;

  goals.forEach(function(g) {
    if (isChecked(g.id, t)) hitToday++;
    const info = streakInfo(g.id);
    bestAll = Math.max(bestAll, info.best);

    const start = g.startDate <= t ? g.startDate : t;
    const end   = g.endDate   <  t ? g.endDate   : t;
    if (end >= start) {
      totalPossible += daysBetween(start, end) + 1;
      totalHit      += info.total;
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
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
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

  container.querySelectorAll('.goal-card').forEach(function(c) { c.remove(); });

  if (goals.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  const priority = { High: 0, Medium: 1, Low: 2 };
  const sorted = goals.slice().sort(function(a, b) {
    return (priority[a.priority] - priority[b.priority]) ||
           a.endDate.localeCompare(b.endDate);
  });

  sorted.forEach(function(g) {
    const card = buildGoalCard(g, t);
    container.insertBefore(card, emptyState);
  });
}

function buildGoalCard(g, t) {
  const card = document.createElement('div');
  card.className = 'goal-card';
  card.setAttribute('data-id', g.id);

  const info    = streakInfo(g.id);
  const checked = isChecked(g.id, t);
  const active  = g.endDate >= t;

  const strip = buildMiniStrip(g, t, 14);

  const daysLeft = daysBetween(t, g.endDate);
  const deadlineLabel = g.endDate < t
    ? '<span style="color:var(--muted)">Ended</span>'
    : daysLeft === 0
    ? '<span style="color:var(--amber)">Last day!</span>'
    : daysLeft + 'd left';

  card.innerHTML =
    '<div class="goal-card-left">' +
      '<div class="goal-card-top">' +
        '<span class="priority-badge ' + g.priority + '">' + g.priority + '</span>' +
        '<span class="goal-title">' + esc(g.name) + '</span>' +
      '</div>' +
      '<div class="goal-meta">' +
        '<span>' + esc(g.category) + '</span>' +
        '<span>' + fmtDate(g.startDate) + ' \u2192 ' + fmtDate(g.endDate) + '</span>' +
        '<span>' + deadlineLabel + '</span>' +
        '<span style="color:var(--sage)">\uD83D\uDD25 ' + info.current + '-day streak</span>' +
      '</div>' +
    '</div>' +
    '<div class="goal-card-right">' +
      '<div class="mini-strip" id="strip-' + g.id + '"></div>' +
      (active
        ? '<button class="tick-btn' + (checked ? ' ticked' : '') + '" data-goalid="' + g.id + '" data-date="' + t + '">' +
            (checked ? '\u2713 Done today' : 'Tick today') +
          '</button>'
        : '<span style="font-size:0.75rem;color:var(--muted)">Completed</span>') +
    '</div>';

  // Tick button
  const tickBtn = card.querySelector('.tick-btn');
  if (tickBtn) {
    tickBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleCheck(g.id, t);
    });
  }

  // Click card to open detail
  card.querySelector('.goal-card-left').addEventListener('click', function() {
    openDetail(g.id);
  });

  // Populate mini strip
  const stripEl = card.querySelector('#strip-' + g.id);
  strip.forEach(function(cell) { stripEl.appendChild(cell); });

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

  const active = goals.filter(function(g) { return g.startDate <= t && g.endDate >= t; });
  const sorted = active.slice().sort(function(a, b) {
    const p = { High: 0, Medium: 1, Low: 2 };
    return p[a.priority] - p[b.priority];
  });

  const container = $('today-tasks');
  container.innerHTML = '';

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">\u2726</div><div class="empty-title">No active goals today.</div><div class="empty-sub">Add a goal from the dashboard first.</div></div>';
    $('today-progress-text').textContent = '0 / 0';
    return;
  }

  let doneCount = 0;
  const groups = { High: [], Medium: [], Low: [] };
  sorted.forEach(function(g) { groups[g.priority].push(g); });

  ['High', 'Medium', 'Low'].forEach(function(priority) {
    const gs = groups[priority];
    if (gs.length === 0) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'today-task-group';

    const labelEl = document.createElement('div');
    labelEl.className = 'today-task-group-label';
    const emoji = priority === 'High' ? '\uD83D\uDD34' : priority === 'Medium' ? '\uD83D\uDFE1' : '\uD83D\uDFE2';
    labelEl.textContent = emoji + ' ' + priority + ' Priority';
    groupEl.appendChild(labelEl);

    gs.forEach(function(g) {
      const checked = isChecked(g.id, t);
      if (checked) doneCount++;

      const mainItem = buildTodayItem(g, null, checked, t);
      groupEl.appendChild(mainItem);

      (g.steps || []).forEach(function(step, i) {
        const stepKey = 'step_' + g.id + '_' + i;
        const stepChecked = !!checks[stepKey + ':' + t];
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

  $('today-progress-text').textContent = doneCount + ' / ' + sorted.length;
}

function buildTodayItem(g, stepText, checked, t, stepKey) {
  const el = document.createElement('div');
  el.className = 'today-task-item' + (checked ? ' completed' : '');

  const id    = stepKey || g.id;
  const label = stepText || g.dailyCommitment || g.name;

  const checkBtn = document.createElement('button');
  checkBtn.className = 'tti-check' + (checked ? ' checked' : '');
  checkBtn.textContent = checked ? '\u2713' : '';

  const content = document.createElement('div');
  content.className = 'tti-content';
  if (!stepText) {
    const goalLabel = document.createElement('div');
    goalLabel.className = 'tti-goal';
    goalLabel.textContent = g.name;
    content.appendChild(goalLabel);
  }
  const nameEl = document.createElement('div');
  nameEl.className = 'tti-name';
  nameEl.textContent = label;
  content.appendChild(nameEl);

  el.appendChild(checkBtn);
  el.appendChild(content);

  checkBtn.addEventListener('click', function() {
    const key = id + ':' + t;
    if (checks[key]) {
      delete checks[key];
      checkBtn.classList.remove('checked');
      checkBtn.textContent = '';
      el.classList.remove('completed');
    } else {
      checks[key] = true;
      checkBtn.classList.add('checked');
      checkBtn.textContent = '\u2713';
      el.classList.add('completed');
    }
    saveChecks();

    const active = goals.filter(function(g) { return g.startDate <= t && g.endDate >= t; });
    const doneCount = active.filter(function(g) { return isChecked(g.id, t); }).length;
    $('today-progress-text').textContent = doneCount + ' / ' + active.length;
    updateStats();
  });

  return el;
}

// ---- Goal Detail --------------------------------------------
function openDetail(goalId) {
  const g = goals.find(function(x) { return x.id === goalId; });
  if (!g) return;
  currentDetailId = goalId;

  $('detail-title').textContent = g.name;
  $('detail-description').textContent = g.description || 'No description provided.';
  $('detail-category').textContent = g.category;

  const pb = $('detail-priority-badge');
  pb.textContent = g.priority;
  pb.className = 'detail-priority-badge ' + g.priority;

  const info = streakInfo(goalId);
  $('ds-streak').textContent = info.current;
  $('ds-best').textContent   = info.best;
  $('ds-total').textContent  = info.total;
  $('ds-rate').textContent   = info.rate + '%';

  const t = today();
  const totalSpan = Math.max(1, daysBetween(g.startDate, g.endDate));
  const elapsed   = clamp(daysBetween(g.startDate, t), 0, totalSpan);
  const pct       = Math.round((elapsed / totalSpan) * 100);
  $('deadline-bar-fill').style.width = pct + '%';
  const dLeft = daysBetween(t, g.endDate);
  $('deadline-days-left').textContent = g.endDate < t ? 'Ended' : dLeft === 0 ? 'Last day!' : dLeft + ' days left';

  renderDetailCalendar(goalId);
  renderBreakdown(g);

  $('delete-goal-btn').onclick = function() { deleteGoal(goalId); };

  showScreen('goal-detail');
}

function renderDetailCalendar(goalId) {
  const g = goals.find(function(x) { return x.id === goalId; });
  if (!g) return;

  const container = $('calendar-grid');
  container.innerHTML = '';

  const t     = today();
  const start = g.startDate;
  const end   = g.endDate;
  const total = daysBetween(start, end) + 1;

  for (let i = 0; i < total; i++) {
    const d    = addDays(start, i);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.setAttribute('data-tooltip', fmtDate(d));

    if (d === t) {
      cell.classList.add('today-cell');
      if (isChecked(goalId, d)) cell.classList.add('done');
      cell.addEventListener('click', function() { toggleCheck(goalId, d); });
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

  const steps = (g.steps && g.steps.length > 0) ? g.steps : generateDefaultSteps(g);

  steps.forEach(function(s, i) {
    const el = document.createElement('div');
    el.className = 'breakdown-task';
    const num = document.createElement('span');
    num.className = 'breakdown-num';
    num.textContent = String(i + 1).padStart(2, '0') + '.';
    const text = document.createElement('span');
    text.className = 'breakdown-text';
    text.textContent = s;
    el.appendChild(num);
    el.appendChild(text);
    container.appendChild(el);
  });
}

function generateDefaultSteps(g) {
  const cat = g.category;
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
    'Clarify what "done" means for today\'s goal',
    'Block out time in your calendar and protect it',
    'Work in a focused burst — remove distractions',
    'Evaluate: did you complete the commitment?',
    'Mark yourself done and note any blockers for tomorrow'
  ];
}

// ---- Delete goal -------------------------------------------
function deleteGoal(goalId) {
  if (!confirm('Delete this goal? This cannot be undone.')) return;
  goals = goals.filter(function(g) { return g.id !== goalId; });
  Object.keys(checks).forEach(function(k) {
    if (k.indexOf(goalId + ':') === 0) delete checks[k];
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
  setTimeout(function() { $('goal-name').focus(); }, 100);
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
  document.querySelectorAll('.priority-opt').forEach(function(btn) {
    btn.classList.toggle('selected', btn.getAttribute('data-val') === selectedPriority);
  });
}

function saveGoal() {
  const name  = $('goal-name').value.trim();
  const start = $('goal-start').value;
  const end   = $('goal-end').value;

  if (!name)       { showToast('Please enter a goal title.', 'error'); return; }
  if (!start)      { showToast('Please set a start date.', 'error');   return; }
  if (!end)        { showToast('Please set a deadline.', 'error');     return; }
  if (end < start) { showToast('Deadline must be after start date.', 'error'); return; }

  const steps = $('goal-steps').value.trim()
    .split('\n')
    .map(function(s) { return s.trim(); })
    .filter(Boolean);

  const existing = editingId ? goals.find(function(g) { return g.id === editingId; }) : null;

  const goal = {
    id:              editingId || uid(),
    name:            name,
    description:     $('goal-desc').value.trim(),
    category:        $('goal-category').value,
    priority:        selectedPriority,
    startDate:       start,
    endDate:         end,
    dailyCommitment: $('goal-daily').value.trim(),
    steps:           steps,
    createdAt:       existing ? existing.createdAt : Date.now()
  };

  if (editingId) {
    goals = goals.map(function(g) { return g.id === editingId ? goal : g; });
  } else {
    goals.push(goal);
  }

  saveGoals();
  $('modal-overlay').classList.remove('open');
  showToast(editingId ? 'Goal updated!' : 'Goal added! Now show up for it. \u2726', 'success');
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

// ---- Wire up static buttons in HTML -------------------------
function bindStaticButtons() {
  // Landing CTA
  const landingCta = $('landing-cta');
  if (landingCta) landingCta.addEventListener('click', function() { showScreen('dashboard'); });

  // Wordmarks (go to dashboard)
  document.querySelectorAll('.wordmark').forEach(function(el) {
    el.addEventListener('click', function() { showScreen('dashboard'); });
  });

  // Dashboard nav
  const todayBtn = document.querySelector('#dashboard .btn-ghost');
  if (todayBtn) todayBtn.addEventListener('click', function() { showScreen('today'); });

  const newGoalBtn = document.querySelector('#dashboard .btn-outline');
  if (newGoalBtn) newGoalBtn.addEventListener('click', openAddGoal);

  const emptyAddBtn = document.querySelector('#empty-state .btn-primary');
  if (emptyAddBtn) emptyAddBtn.addEventListener('click', openAddGoal);

  // Today screen back button
  const todayBack = document.querySelector('#today .btn-ghost');
  if (todayBack) todayBack.addEventListener('click', function() { showScreen('dashboard'); });

  // Goal detail back button
  const detailBack = document.querySelector('#goal-detail .btn-ghost');
  if (detailBack) detailBack.addEventListener('click', function() { showScreen('dashboard'); });

  // Modal overlay click-outside
  $('modal-overlay').addEventListener('click', function(e) {
    if (e.target === $('modal-overlay')) $('modal-overlay').classList.remove('open');
  });

  // Modal close X
  document.querySelector('.modal-close').addEventListener('click', function() {
    $('modal-overlay').classList.remove('open');
  });

  // Modal cancel
  document.querySelector('.modal-footer .btn-ghost').addEventListener('click', function() {
    $('modal-overlay').classList.remove('open');
  });

  // Modal save
  document.querySelector('.modal-footer .btn-primary').addEventListener('click', saveGoal);

  // Priority picker
  document.querySelectorAll('.priority-opt').forEach(function(btn) {
    btn.addEventListener('click', function() { selectPriority(btn.getAttribute('data-val')); });
  });

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') $('modal-overlay').classList.remove('open');
  });
}

// ---- Init --------------------------------------------------
loadData();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    bindStaticButtons();
    showScreen(goals.length === 0 ? 'landing' : 'dashboard');
  });
} else {
  bindStaticButtons();
  showScreen(goals.length === 0 ? 'landing' : 'dashboard');
}
