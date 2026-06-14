'use strict';

var STORAGE_KEY = 'streaks_goals_v1';
var CHECKS_KEY  = 'streaks_checks_v1';

var goals            = [];
var checks           = {};
var editingId        = null;
var selectedPriority = 'High';
var currentDetailId  = null;

function $(id) { return document.getElementById(id); }
function today() { return new Date().toISOString().slice(0, 10); }
function uid() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }

function fmtDate(iso) {
  if (!iso) return '';
  var parts = iso.split('-');
  return new Date(+parts[0], +parts[1]-1, +parts[2]).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function addDays(iso, n) {
  var d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function showToast(msg, type) {
  var t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(function() { t.className = 'toast'; }, 3000);
}

function saveGoals() { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); }
function saveChecks() { localStorage.setItem(CHECKS_KEY,  JSON.stringify(checks)); }

function loadData() {
  try { goals  = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) { goals  = []; }
  try { checks = JSON.parse(localStorage.getItem(CHECKS_KEY))  || {}; } catch(e) { checks = {}; }
}

function checkKey(goalId, date) { return goalId + ':' + date; }
function isChecked(goalId, date) { return !!checks[checkKey(goalId, date)]; }

function toggleCheck(goalId, date) {
  var key = checkKey(goalId, date);
  if (checks[key]) { delete checks[key]; } else { checks[key] = true; }
  saveChecks();
  refreshDashboard();
  if (currentDetailId === goalId) renderDetailCalendar(goalId);
  updateStats();
}

function streakInfo(goalId) {
  var g = null;
  for (var i = 0; i < goals.length; i++) { if (goals[i].id === goalId) { g = goals[i]; break; } }
  if (!g) return {current:0, best:0, total:0, rate:0};
  var t = today();
  var start = g.startDate <= t ? g.startDate : t;
  var end   = g.endDate   <  t ? g.endDate   : t;
  var cur = 0, best = 0, total = 0, d = start;
  while (d <= end) {
    if (isChecked(goalId, d)) { total++; cur++; } else { cur = 0; }
    if (cur > best) best = cur;
    d = addDays(d, 1);
  }
  var cs = 0, dd = t;
  while (dd >= start) {
    if (isChecked(goalId, dd)) { cs++; } else { break; }
    dd = addDays(dd, -1);
  }
  var totalDays = Math.max(1, daysBetween(start, end) + 1);
  return {current:cs, best:best, total:total, rate:Math.round((total/totalDays)*100)};
}

function updateStats() {
  var t = today();
  var active = goals.filter(function(g) { return g.endDate >= t; });
  $('total-goals').textContent = active.length;
  var hitToday = 0, bestAll = 0, totalHit = 0, totalPossible = 0;
  goals.forEach(function(g) {
    if (isChecked(g.id, t)) hitToday++;
    var info = streakInfo(g.id);
    if (info.best > bestAll) bestAll = info.best;
    var s = g.startDate <= t ? g.startDate : t;
    var e = g.endDate   <  t ? g.endDate   : t;
    if (e >= s) { totalPossible += daysBetween(s,e)+1; totalHit += info.total; }
  });
  $('streak-today').textContent   = hitToday;
  $('best-streak').textContent    = bestAll;
  $('completion-rate').textContent = totalPossible ? Math.round((totalHit/totalPossible)*100)+'%' : '0%';
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  $(name).classList.add('active');
  if (name === 'dashboard') refreshDashboard();
  if (name === 'today')     renderToday();
}

function refreshDashboard() {
  var t = today();
  $('goals-date-label').textContent = fmtDate(t);
  updateStats();
  var container = $('goals-container');
  var emptyState = $('empty-state');
  container.querySelectorAll('.goal-card').forEach(function(c) { c.remove(); });
  if (goals.length === 0) { emptyState.style.display = 'flex'; return; }
  emptyState.style.display = 'none';
  var priority = {High:0, Medium:1, Low:2};
  var sorted = goals.slice().sort(function(a,b) {
    return (priority[a.priority] - priority[b.priority]) || a.endDate.localeCompare(b.endDate);
  });
  sorted.forEach(function(g) { container.insertBefore(buildGoalCard(g, t), emptyState); });
}

function buildGoalCard(g, t) {
  var card = document.createElement('div');
  card.className = 'goal-card';
  var info    = streakInfo(g.id);
  var checked = isChecked(g.id, t);
  var active  = g.endDate >= t;
  var daysLeft = daysBetween(t, g.endDate);
  var deadlineText = g.endDate < t ? 'Ended' : daysLeft === 0 ? 'Last day!' : daysLeft + 'd left';

  // Left side
  var left = document.createElement('div');
  left.className = 'goal-card-left';
  left.innerHTML =
    '<div class="goal-card-top">' +
      '<span class="priority-badge ' + g.priority + '">' + g.priority + '</span>' +
      '<span class="goal-title">' + esc(g.name) + '</span>' +
    '</div>' +
    '<div class="goal-meta">' +
      '<span>' + esc(g.category) + '</span>' +
      '<span>' + fmtDate(g.startDate) + ' → ' + fmtDate(g.endDate) + '</span>' +
      '<span>' + deadlineText + '</span>' +
      '<span style="color:var(--sage)">🔥 ' + info.current + '-day streak</span>' +
    '</div>';
  left.addEventListener('click', function() { openDetail(g.id); });

  // Right side
  var right = document.createElement('div');
  right.className = 'goal-card-right';

  var strip = document.createElement('div');
  strip.className = 'mini-strip';
  for (var i = 13; i >= 0; i--) {
    var d = addDays(t, -i);
    var cell = document.createElement('div');
    cell.className = 'mini-cell';
    if (d < g.startDate || d > g.endDate) cell.classList.add('future');
    else if (isChecked(g.id, d)) cell.classList.add('done');
    else if (d < t) cell.classList.add('missed');
    if (d === t) cell.classList.add('today');
    strip.appendChild(cell);
  }
  right.appendChild(strip);

  if (active) {
    var tickBtn = document.createElement('button');
    tickBtn.className = 'tick-btn' + (checked ? ' ticked' : '');
    tickBtn.textContent = checked ? '✓ Done today' : 'Tick today';
    tickBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleCheck(g.id, t);
    });
    right.appendChild(tickBtn);
  } else {
    var doneSpan = document.createElement('span');
    doneSpan.style.cssText = 'font-size:0.75rem;color:var(--muted)';
    doneSpan.textContent = 'Completed';
    right.appendChild(doneSpan);
  }

  card.appendChild(left);
  card.appendChild(right);
  return card;
}

function renderToday() {
  var t = today();
  $('today-date-label').textContent = new Date().toLocaleDateString('en-GB', {weekday:'long',day:'numeric',month:'long'});
  var active = goals.filter(function(g) { return g.startDate <= t && g.endDate >= t; });
  var sorted = active.slice().sort(function(a,b) {
    var p = {High:0, Medium:1, Low:2};
    return p[a.priority] - p[b.priority];
  });
  var container = $('today-tasks');
  container.innerHTML = '';
  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✦</div><div class="empty-title">No active goals today.</div><div class="empty-sub">Add a goal from the dashboard first.</div></div>';
    $('today-progress-text').textContent = '0 / 0';
    return;
  }
  var doneCount = 0;
  var groups = {High:[], Medium:[], Low:[]};
  sorted.forEach(function(g) { groups[g.priority].push(g); });
  ['High','Medium','Low'].forEach(function(priority) {
    var gs = groups[priority];
    if (!gs.length) return;
    var groupEl = document.createElement('div');
    groupEl.className = 'today-task-group';
    var label = document.createElement('div');
    label.className = 'today-task-group-label';
    label.textContent = (priority==='High'?'🔴':priority==='Medium'?'🟡':'🟢') + ' ' + priority + ' Priority';
    groupEl.appendChild(label);
    gs.forEach(function(g) {
      var checked = isChecked(g.id, t);
      if (checked) doneCount++;
      groupEl.appendChild(buildTodayItem(g, null, checked, t, null));
      (g.steps||[]).forEach(function(step, i) {
        var stepKey = 'step_' + g.id + '_' + i;
        var sc = !!checks[stepKey+':'+t];
        var el = buildTodayItem(g, step, sc, t, stepKey);
        el.style.marginLeft = '1.5rem';
        el.style.borderColor = 'transparent';
        el.style.background  = 'transparent';
        el.style.paddingTop  = '0.4rem';
        el.style.paddingBottom = '0.4rem';
        groupEl.appendChild(el);
      });
    });
    container.appendChild(groupEl);
  });
  $('today-progress-text').textContent = doneCount + ' / ' + sorted.length;
}

function buildTodayItem(g, stepText, checked, t, stepKey) {
  var el = document.createElement('div');
  el.className = 'today-task-item' + (checked ? ' completed' : '');
  var id    = stepKey || g.id;
  var label = stepText || g.dailyCommitment || g.name;
  var checkBtn = document.createElement('button');
  checkBtn.className = 'tti-check' + (checked ? ' checked' : '');
  checkBtn.textContent = checked ? '✓' : '';
  var content = document.createElement('div');
  content.className = 'tti-content';
  if (!stepText) {
    var gl = document.createElement('div');
    gl.className = 'tti-goal';
    gl.textContent = g.name;
    content.appendChild(gl);
  }
  var nl = document.createElement('div');
  nl.className = 'tti-name';
  nl.textContent = label;
  content.appendChild(nl);
  el.appendChild(checkBtn);
  el.appendChild(content);
  checkBtn.addEventListener('click', function() {
    var key = id + ':' + t;
    if (checks[key]) { delete checks[key]; checkBtn.classList.remove('checked'); checkBtn.textContent=''; el.classList.remove('completed'); }
    else             { checks[key]=true;   checkBtn.classList.add('checked');    checkBtn.textContent='✓'; el.classList.add('completed'); }
    saveChecks();
    var activeGoals = goals.filter(function(g){ return g.startDate<=t && g.endDate>=t; });
    var done = activeGoals.filter(function(g){ return isChecked(g.id,t); }).length;
    $('today-progress-text').textContent = done + ' / ' + activeGoals.length;
    updateStats();
  });
  return el;
}

function openDetail(goalId) {
  var g = null;
  for (var i = 0; i < goals.length; i++) { if (goals[i].id === goalId) { g = goals[i]; break; } }
  if (!g) return;
  currentDetailId = goalId;
  $('detail-title').textContent       = g.name;
  $('detail-description').textContent = g.description || 'No description provided.';
  $('detail-category').textContent    = g.category;
  var pb = $('detail-priority-badge');
  pb.textContent = g.priority;
  pb.className   = 'detail-priority-badge ' + g.priority;
  var info = streakInfo(goalId);
  $('ds-streak').textContent = info.current;
  $('ds-best').textContent   = info.best;
  $('ds-total').textContent  = info.total;
  $('ds-rate').textContent   = info.rate + '%';
  var t = today();
  var totalSpan = Math.max(1, daysBetween(g.startDate, g.endDate));
  var elapsed   = clamp(daysBetween(g.startDate, t), 0, totalSpan);
  $('deadline-bar-fill').style.width = Math.round((elapsed/totalSpan)*100) + '%';
  var dLeft = daysBetween(t, g.endDate);
  $('deadline-days-left').textContent = g.endDate < t ? 'Ended' : dLeft === 0 ? 'Last day!' : dLeft + ' days left';
  renderDetailCalendar(goalId);
  renderBreakdown(g);
  $('delete-goal-btn').onclick = function() { deleteGoal(goalId); };
  showScreen('goal-detail');
}

function renderDetailCalendar(goalId) {
  var g = null;
  for (var i = 0; i < goals.length; i++) { if (goals[i].id === goalId) { g = goals[i]; break; } }
  if (!g) return;
  var container = $('calendar-grid');
  container.innerHTML = '';
  var t = today(), d = g.startDate, end = g.endDate;
  var total = daysBetween(d, end) + 1;
  for (var i = 0; i < total; i++) {
    var day = addDays(g.startDate, i);
    var cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.setAttribute('data-tooltip', fmtDate(day));
    if (day === t) {
      cell.classList.add('today-cell');
      if (isChecked(goalId, day)) cell.classList.add('done');
      (function(day){ cell.addEventListener('click', function() { toggleCheck(goalId, day); }); })(day);
    } else if (day < t) {
      cell.classList.add(isChecked(goalId, day) ? 'done' : 'missed');
    } else {
      cell.classList.add('future');
    }
    container.appendChild(cell);
  }
}

function renderBreakdown(g) {
  var container = $('breakdown-tasks');
  container.innerHTML = '';
  var steps = (g.steps && g.steps.length) ? g.steps : generateDefaultSteps(g);
  steps.forEach(function(s, i) {
    var el = document.createElement('div');
    el.className = 'breakdown-task';
    var num = document.createElement('span'); num.className='breakdown-num'; num.textContent = String(i+1).padStart(2,'0')+'.';
    var tx  = document.createElement('span'); tx.className='breakdown-text';  tx.textContent = s;
    el.appendChild(num); el.appendChild(tx);
    container.appendChild(el);
  });
}

function generateDefaultSteps(g) {
  var cat = g.category;
  if (cat==='Health') return ['Set out workout clothes the night before','Start with a 5-minute warm-up','Complete your main activity','Cool down and stretch for 5 minutes','Log your session — time, how it felt, notes'];
  if (cat==='Creative') return ['Open your workspace — no distractions','Read the last thing you wrote / drew / made','Set a 25-minute focused creation block','Rest 5 min, then decide: done or another block?','Save your work and note tomorrow\'s starting point'];
  if (cat==='Learning') return ['Review yesterday\'s notes for 5 minutes','Read or watch for 30 focused minutes — take notes','Write a 3-sentence summary of what you learned','Do one practice problem or apply one concept','Update your learning log'];
  if (cat==='Finance') return ['Check your balance and spending since yesterday','Log any purchases in your budget tracker','Take one action towards your financial goal','Review if you\'re on track for the week','Note one win and one thing to improve'];
  return ['Clarify what "done" looks like for today','Block time in your calendar and protect it','Work in a focused burst — remove distractions','Evaluate: did you complete the commitment?','Mark done and note any blockers for tomorrow'];
}

function deleteGoal(goalId) {
  if (!confirm('Delete this goal? This cannot be undone.')) return;
  goals = goals.filter(function(g) { return g.id !== goalId; });
  Object.keys(checks).forEach(function(k) { if (k.indexOf(goalId+':')===0) delete checks[k]; });
  saveGoals(); saveChecks();
  showToast('Goal deleted.', 'error');
  showScreen('dashboard');
}

function openAddGoal() {
  editingId = null; selectedPriority = 'High';
  $('modal-title').textContent = 'New Goal';
  $('goal-name').value  = '';
  $('goal-desc').value  = '';
  $('goal-category').value = 'Health';
  $('goal-daily').value = '';
  $('goal-steps').value = '';
  $('goal-start').value = today();
  $('goal-end').value   = addDays(today(), 30);
  updatePriorityUI();
  $('modal-overlay').classList.add('open');
  setTimeout(function(){ $('goal-name').focus(); }, 80);
}

function closeModal() { $('modal-overlay').classList.remove('open'); }

function selectPriority(val) { selectedPriority = val; updatePriorityUI(); }

function updatePriorityUI() {
  document.querySelectorAll('.priority-opt').forEach(function(btn) {
    btn.classList.toggle('selected', btn.getAttribute('data-val') === selectedPriority);
  });
}

function saveGoal() {
  var name  = $('goal-name').value.trim();
  var start = $('goal-start').value;
  var end   = $('goal-end').value;
  if (!name)       { showToast('Please enter a goal title.','error'); return; }
  if (!start)      { showToast('Please set a start date.','error');   return; }
  if (!end)        { showToast('Please set a deadline.','error');     return; }
  if (end < start) { showToast('Deadline must be after start date.','error'); return; }
  var steps = $('goal-steps').value.trim().split('\n').map(function(s){return s.trim();}).filter(Boolean);
  var existing = null;
  if (editingId) for (var i=0;i<goals.length;i++) { if (goals[i].id===editingId) { existing=goals[i]; break; } }
  var goal = {
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
  if (editingId) { goals = goals.map(function(g){ return g.id===editingId ? goal : g; }); }
  else { goals.push(goal); }
  saveGoals();
  closeModal();
  showToast(editingId ? 'Goal updated!' : 'Goal added! Now show up for it. ✦', 'success');
  refreshDashboard();
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function init() {
  loadData();

  $('landing-cta').addEventListener('click',   function(){ showScreen('dashboard'); });
  $('logo-dashboard').addEventListener('click', function(){ showScreen('dashboard'); });
  $('logo-today').addEventListener('click',     function(){ showScreen('dashboard'); });
  $('logo-detail').addEventListener('click',    function(){ showScreen('dashboard'); });
  $('nav-today').addEventListener('click',      function(){ showScreen('today'); });
  $('nav-new-goal').addEventListener('click',   openAddGoal);
  $('empty-add-btn').addEventListener('click',  openAddGoal);
  $('today-back').addEventListener('click',     function(){ showScreen('dashboard'); });
  $('detail-back').addEventListener('click',    function(){ showScreen('dashboard'); });
  $('modal-close-btn').addEventListener('click',  closeModal);
  $('modal-cancel-btn').addEventListener('click', closeModal);
  $('modal-save-btn').addEventListener('click',   saveGoal);
  $('modal-overlay').addEventListener('click', function(e){ if (e.target===$('modal-overlay')) closeModal(); });

  document.querySelectorAll('.priority-opt').forEach(function(btn) {
    btn.addEventListener('click', function(){ selectPriority(btn.getAttribute('data-val')); });
  });

  document.addEventListener('keydown', function(e){ if (e.key==='Escape') closeModal(); });

  showScreen(goals.length === 0 ? 'landing' : 'dashboard');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
