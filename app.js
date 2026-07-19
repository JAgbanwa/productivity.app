(function () {
  'use strict';

  var P = window.MomentumPlanner;
  var STORAGE_KEY = 'momentum_v4_state';
  var state = loadState();
  var currentRoute = 'home';
  var currentGoalId = state.selectedGoalId || (state.goals[0] && state.goals[0].id) || null;
  var wizardStep = 1;
  var wizardData = {};
  var wizardPlan = null;
  var wizardEditId = null;
  var lastFocus = null;

  function $(id) { return document.getElementById(id); }
  function qsa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; }); }
  function attr(value) { return esc(value).replace(/`/g, '&#96;'); }
  function formatDate(iso, options) { return P.parseISO(iso).toLocaleDateString('en', options || { month: 'short', day: 'numeric', year: 'numeric' }); }
  function plural(value, word) { return value + ' ' + word + (value === 1 ? '' : 's'); }

  function defaultState() { return { version: 4, goals: [], taskChecks: {}, chats: {}, selectedGoalId: null, demo: false }; }
  function loadState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.goals)) return Object.assign(defaultState(), parsed, { taskChecks: parsed.taskChecks || {}, chats: parsed.chats || {} });
    } catch (error) { /* use migration/fresh state */ }
    return migrateLegacy() || defaultState();
  }
  function migrateLegacy() {
    try {
      var oldGoals = JSON.parse(localStorage.getItem('streaks_v2_goals') || '[]');
      var oldChecks = JSON.parse(localStorage.getItem('streaks_v2_checks') || '{}');
      if (!oldGoals.length) return null;
      var categoryMap = { Health: 'Fitness', Creative: 'Creative', Learning: 'Learning', Career: 'Career', Finance: 'Finance', Relationships: 'Wellbeing', Mindfulness: 'Wellbeing', Other: 'Other' };
      var migrated = defaultState();
      migrated.goals = oldGoals.map(function (old) {
        var category = categoryMap[old.category] || 'Other';
        return P.createGoal({
          id: old.id,
          title: old.name,
          why: old.description || '',
          category: category,
          method: P.configFor(category).methods[0].id,
          level: 'Beginner', daysPerWeek: 7, minutesPerDay: 30,
          startDate: old.startDate, deadline: old.endDate,
          priority: old.priority || 'Medium', createdAt: old.createdAt || Date.now()
        });
      });
      Object.keys(oldChecks).forEach(function (key) {
        if (!oldChecks[key] || key.indexOf('step_') === 0) return;
        var splitAt = key.indexOf(':');
        if (splitAt < 0) return;
        var goalId = key.slice(0, splitAt), date = key.slice(splitAt + 1);
        var goal = migrated.goals.find(function (item) { return item.id === goalId; });
        if (!goal || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        P.getDailyTasks(goal, date).forEach(function (item) { migrated.taskChecks[P.taskKey(goal.id, date, item.id)] = true; });
      });
      migrated.selectedGoalId = migrated.goals[0].id;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (error) { return null; }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function goalById(id) { return state.goals.find(function (goal) { return goal.id === id; }); }

  function boot() {
    renderLandingHeatmap();
    bindStaticEvents();
    if (state.goals.length) openApp('home');
    else showLanding();
  }

  function bindStaticEvents() {
    document.addEventListener('click', function (event) {
      var routeButton = event.target.closest('[data-route]');
      if (routeButton) {
        event.preventDefault();
        var route = routeButton.getAttribute('data-route');
        if (route === 'goal') routeToGoal(routeButton.getAttribute('data-goal-id'));
        else routeTo(route);
        return;
      }
      var actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      var action = actionButton.getAttribute('data-action');
      if (action === 'start-goal') openWizard();
      else if (action === 'open-demo') openDemo();
      else if (action === 'close-modal') closeWizard();
      else if (action === 'open-today') routeTo('today');
      else if (action === 'complete-focus') toggleTask(actionButton.getAttribute('data-goal-id'), P.todayISO(), actionButton.getAttribute('data-task-id'));
      else if (action === 'toggle-task') toggleTask(actionButton.getAttribute('data-goal-id'), actionButton.getAttribute('data-date'), actionButton.getAttribute('data-task-id'));
      else if (action === 'toggle-day') toggleWholeDay(actionButton.getAttribute('data-goal-id'), actionButton.getAttribute('data-date'));
      else if (action === 'edit-goal') openWizard(goalById(actionButton.getAttribute('data-goal-id')));
      else if (action === 'delete-goal') deleteGoal(actionButton.getAttribute('data-goal-id'));
      else if (action === 'rebalance-goal') rebalanceGoal(actionButton.getAttribute('data-goal-id'));
      else if (action === 'coach-prompt') submitCoach(actionButton.getAttribute('data-prompt'));
      else if (action === 'coach-response') handleCoachAction(actionButton.getAttribute('data-coach-action'));
    });
    $('wizard-back').addEventListener('click', wizardBack);
    $('wizard-next').addEventListener('click', wizardNext);
    $('goal-modal').addEventListener('click', function (event) { if (event.target === $('goal-modal')) closeWizard(); });
    $('minutes-range').addEventListener('input', function () { $('minutes-value').textContent = this.value; wizardData.minutesPerDay = Number(this.value); });
    $('coach-form').addEventListener('submit', function (event) { event.preventDefault(); submitCoach($('coach-input').value); });
    $('coach-goal-select').addEventListener('change', function () { currentGoalId = this.value; state.selectedGoalId = currentGoalId; saveState(); renderCoach(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !$('goal-modal').hidden) closeWizard(); });
  }

  function renderLandingHeatmap() {
    var cells = '';
    for (var i = 0; i < 64; i++) {
      var level = (i * 7 + Math.floor(i / 3)) % 11;
      cells += '<i class="' + (level > 8 ? 'l3' : level > 5 ? 'l2' : level > 2 ? 'l1' : '') + '"></i>';
    }
    $('landing-heatmap').innerHTML = cells;
  }
  function showLanding() { $('landing').hidden = false; $('app-shell').hidden = true; document.title = 'Momentum — Build the system. Become the person.'; }
  function openDemo() {
    state = P.createDemoState();
    currentGoalId = state.selectedGoalId;
    saveState();
    openApp('home');
    showToast('Demo loaded. Every check, plan, and coach action is interactive.', 'success');
  }
  function openApp(route) { $('landing').hidden = true; $('app-shell').hidden = false; renderSidebar(); routeTo(route || 'home'); }

  function routeTo(route) {
    if (route === 'goal' && !currentGoalId) route = 'home';
    currentRoute = route;
    qsa('.view').forEach(function (view) { view.classList.toggle('active', view.id === 'view-' + route); });
    qsa('[data-route]').forEach(function (button) { button.classList.toggle('active', button.getAttribute('data-route') === route); });
    if (route === 'home') renderHome();
    if (route === 'today') renderToday();
    if (route === 'coach') renderCoach();
    if (route === 'goal') renderGoalDetail();
    renderSidebar();
    document.title = (route === 'home' ? 'Overview' : route === 'today' ? 'Today' : route === 'coach' ? 'Momentum Coach' : (goalById(currentGoalId) || {}).title || 'Goal') + ' — Momentum';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function routeToGoal(id) { if (!goalById(id)) return; currentGoalId = id; state.selectedGoalId = id; saveState(); routeTo('goal'); }

  function renderSidebar() {
    var todayTasks = allTodayTasks();
    var todayDone = todayTasks.filter(function (row) { return !!state.taskChecks[P.taskKey(row.goal.id, P.todayISO(), row.task.id)]; }).length;
    $('today-nav-count').textContent = Math.max(0, todayTasks.length - todayDone);
    $('side-goal-list').innerHTML = state.goals.map(function (goal) {
      var cfg = P.configFor(goal.category);
      return '<button class="side-goal ' + (currentRoute === 'goal' && currentGoalId === goal.id ? 'active' : '') + '" type="button" data-route="goal" data-goal-id="' + attr(goal.id) + '" style="--goal-color:' + cfg.color + '"><i></i><span>' + esc(goal.title) + '</span></button>';
    }).join('');
  }

  function activeGoals(date) { return state.goals.filter(function (goal) { return goal.startDate <= date && goal.deadline >= date; }); }
  function allTodayTasks() {
    var today = P.todayISO(), rows = [];
    activeGoals(today).forEach(function (goal) { P.getDailyTasks(goal, today).forEach(function (task) { rows.push({ goal: goal, task: task }); }); });
    return rows;
  }
  function firstIncomplete() {
    var today = P.todayISO(), goals = activeGoals(today).slice().sort(function (a, b) { return ({ High: 0, Medium: 1, Low: 2 }[a.priority] || 1) - ({ High: 0, Medium: 1, Low: 2 }[b.priority] || 1); });
    for (var i = 0; i < goals.length; i++) {
      var tasks = P.getDailyTasks(goals[i], today);
      for (var j = 0; j < tasks.length; j++) if (!state.taskChecks[P.taskKey(goals[i].id, today, tasks[j].id)]) return { goal: goals[i], task: tasks[j] };
    }
    return goals.length ? { goal: goals[0], task: P.getDailyTasks(goals[0], today)[0], done: true } : null;
  }

  function renderHome() {
    $('home-date').textContent = formatDate(P.todayISO(), { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    var container = $('home-content');
    if (!state.goals.length) {
      container.innerHTML = '<div class="empty-panel"><div><span class="coach-orb">✦</span><h3>Ambition needs a shape.</h3><p>Tell Momentum what you want to change. It will turn the outcome, deadline, and time you actually have into a system you can begin today.</p><button class="button button-primary" type="button" data-action="start-goal">Design my first system →</button></div></div>';
      return;
    }
    var focus = firstIncomplete();
    var allStats = state.goals.map(function (goal) { return P.getStats(goal, state.taskChecks); });
    var bestStreak = Math.max.apply(null, allStats.map(function (stats) { return stats.bestStreak; }).concat([0]));
    var totalHit = allStats.reduce(function (sum, stats) { return sum + stats.daysHit; }, 0);
    var todayRows = allTodayTasks(), todayDone = todayRows.filter(function (row) { return state.taskChecks[P.taskKey(row.goal.id, P.todayISO(), row.task.id)]; }).length;
    var completion = todayRows.length ? Math.round(todayDone / todayRows.length * 100) : 0;
    var focusCfg = P.configFor(focus.goal.category), focusPhase = P.phaseFor(focus.goal, P.todayISO());
    container.innerHTML =
      '<div class="home-grid">' +
        '<article class="focus-card" style="--goal-color:' + focusCfg.color + '">' +
          '<div class="focus-top"><span class="focus-label">' + (focus.done ? 'TODAY IS COMPLETE' : 'NEXT BEST ACTION') + '</span><span class="phase-chip">' + esc(focusPhase.name) + ' phase</span></div>' +
          '<h3>' + esc(focus.done ? 'You kept today’s promise.' : focus.goal.title) + '</h3><p>' + esc(focus.done ? 'Recovery and stopping are part of a sustainable system.' : focusPhase.outcome) + '</p>' +
          '<div class="focus-actions"><button type="button" class="focus-check ' + (focus.done ? 'done' : '') + '" data-action="complete-focus" data-goal-id="' + attr(focus.goal.id) + '" data-task-id="' + attr(focus.task.id) + '" aria-label="Toggle next task">' + (focus.done ? '✓' : '') + '</button><div class="focus-task"><small>' + esc(focus.task.meta) + ' · ' + focus.task.minutes + ' MIN</small><b>' + esc(focus.task.label) + '</b></div><button class="focus-open" type="button" data-action="open-today">Open today →</button></div>' +
        '</article>' +
        '<div class="metrics-grid"><div class="metric"><b class="lime">' + completion + '%</b><span>today complete</span></div><div class="metric"><b>' + bestStreak + '</b><span>best streak</span></div><div class="metric"><b>' + totalHit + '</b><span>proof days</span></div><div class="metric"><b>' + state.goals.length + '</b><span>active systems</span></div></div>' +
      '</div>' +
      '<div class="section-row"><h3>Your systems</h3><button type="button" data-action="start-goal">+ Add another goal</button></div>' +
      '<div class="goal-list">' + state.goals.map(renderGoalCard).join('') + '</div>';
  }

  function renderGoalCard(goal) {
    var cfg = P.configFor(goal.category), stats = P.getStats(goal, state.taskChecks), phase = P.phaseFor(goal, P.todayISO());
    var dateProgress = clampPercent((P.diffDays(goal.startDate, P.todayISO()) + 1) / Math.max(1, P.diffDays(goal.startDate, goal.deadline) + 1) * 100);
    var daysLeft = P.diffDays(P.todayISO(), goal.deadline);
    var cells = '';
    for (var i = 27; i >= 0; i--) {
      var date = P.addDays(P.todayISO(), -i), progress = date < goal.startDate ? 0 : P.dayProgress(goal, date, state.taskChecks);
      cells += '<i class="heat-cell ' + (progress === 1 ? 'hit' : progress > 0 ? 'partial' : date < P.todayISO() && date >= goal.startDate ? 'missed' : '') + (date === P.todayISO() ? ' today' : '') + '"></i>';
    }
    return '<article class="goal-card" data-route="goal" data-goal-id="' + attr(goal.id) + '" style="--goal-color:' + cfg.color + '"><div class="goal-card-main"><div class="goal-card-head"><i class="goal-dot"></i><h4>' + esc(goal.title) + '</h4></div><div class="goal-card-meta"><span>' + esc(phase.name) + ' phase</span><span>' + (daysLeft < 0 ? 'Deadline passed' : plural(daysLeft, 'day') + ' left') + '</span><span class="on-track">' + stats.currentStreak + '-day streak</span></div><div class="goal-progress-row"><div class="thin-progress"><i style="width:' + dateProgress + '%"></i></div><span>' + dateProgress + '% timeline</span></div></div><div class="goal-card-side"><div class="mini-heatmap">' + cells + '</div><span class="goal-arrow">→</span></div></article>';
  }

  function renderToday() {
    var today = P.todayISO();
    $('today-overline').textContent = formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    var goals = activeGoals(today), allTasks = allTodayTasks();
    var complete = allTasks.filter(function (row) { return !!state.taskChecks[P.taskKey(row.goal.id, today, row.task.id)]; }).length;
    var score = allTasks.length ? Math.round(complete / allTasks.length * 100) : 0;
    $('day-score-value').textContent = score + '%';
    $('today-subtitle').textContent = score === 100 ? 'You kept the promise. Stop cleanly and recover.' : 'Your plan has already made the decisions.';
    if (!goals.length) { $('today-content').innerHTML = '<div class="rest-day"><span class="coach-orb">✦</span><h3>No system begins today.</h3><p>Create a goal or enjoy the space you intentionally left open.</p></div>'; return; }
    var groups = goals.map(function (goal) {
      var cfg = P.configFor(goal.category), tasks = P.getDailyTasks(goal, today), done = tasks.filter(function (item) { return state.taskChecks[P.taskKey(goal.id, today, item.id)]; }).length;
      return '<section class="today-goal-group" style="--goal-color:' + cfg.color + '"><header class="today-group-head"><div class="today-group-title"><i></i><b>' + esc(goal.title) + '</b><span>' + esc(P.phaseFor(goal, today).name) + '</span></div><span>' + done + ' / ' + tasks.length + '</span></header>' + tasks.map(function (item) {
        var checked = !!state.taskChecks[P.taskKey(goal.id, today, item.id)];
        return '<div class="task-row ' + (checked ? 'done' : '') + '"><button class="task-toggle" type="button" data-action="toggle-task" data-goal-id="' + attr(goal.id) + '" data-date="' + today + '" data-task-id="' + attr(item.id) + '" aria-label="Toggle ' + attr(item.label) + '">' + (checked ? '✓' : '') + '</button><div class="task-copy"><small>' + esc(item.meta) + '</small><b>' + esc(item.label) + '</b></div><span class="task-time">' + item.minutes + ' min</span></div>';
      }).join('') + '</section>';
    }).join('');
    $('today-content').innerHTML = '<div class="today-layout"><div class="today-list">' + groups + '</div><aside class="today-aside"><div class="aside-card"><span class="overline">DAY SCORE</span><h4>' + complete + ' of ' + allTasks.length + ' actions complete</h4><div class="day-meter"><i style="width:' + score + '%"></i></div><p>The score measures follow-through, not your worth.</p></div><div class="aside-card"><span class="overline">TODAY’S PRINCIPLE</span><p class="principle">A smaller action completed today beats a perfect plan restarted next Monday.</p><button class="button button-quiet" type="button" data-route="coach">Ask coach to adapt →</button></div></aside></div>';
  }

  function renderCoach() {
    var select = $('coach-goal-select');
    if (!state.goals.length) {
      select.innerHTML = '<option>No goals yet</option>'; select.disabled = true;
      $('coach-context-card').innerHTML = '<p>Create a goal to give your coach a real deadline, path, and daily system.</p>';
    } else {
      select.disabled = false;
      if (!goalById(currentGoalId)) currentGoalId = state.goals[0].id;
      select.innerHTML = state.goals.map(function (goal) { return '<option value="' + attr(goal.id) + '" ' + (goal.id === currentGoalId ? 'selected' : '') + '>' + esc(goal.title) + '</option>'; }).join('');
      var goal = goalById(currentGoalId), stats = P.getStats(goal, state.taskChecks), cfg = P.configFor(goal.category);
      $('coach-context-card').innerHTML = '<div style="--goal-color:' + cfg.color + '"><h4>' + esc(goal.title) + '</h4><p>' + esc(goal.plan.summary) + '</p><div class="context-stat"><span>Current phase</span><b>' + esc(P.phaseFor(goal, P.todayISO()).name) + '</b></div><div class="context-stat"><span>Follow-through</span><b>' + stats.taskRate + '%</b></div><div class="context-stat"><span>Deadline</span><b>' + formatDate(goal.deadline, { month: 'short', day: 'numeric' }) + '</b></div></div>';
    }
    var chatKey = currentGoalId || 'none';
    if (!state.chats[chatKey] || !state.chats[chatKey].length) state.chats[chatKey] = [{ role: 'assistant', text: welcomeMessage(goalById(currentGoalId)), source: 'local' }];
    renderCoachMessages();
    var prompts = ['What should I do next?', 'I missed a few days', 'Make today shorter', 'How is my progress?'];
    $('coach-prompts').innerHTML = prompts.map(function (prompt) { return '<button class="prompt-chip" type="button" data-action="coach-prompt" data-prompt="' + attr(prompt) + '">' + esc(prompt) + '</button>'; }).join('');
  }

  function welcomeMessage(goal) {
    if (!goal) return 'Create a goal and I’ll help turn it into the smallest useful next action.';
    var first = P.getDailyTasks(goal, P.todayISO())[0];
    return 'I’m grounded in your “' + goal.title + '” system. Today belongs to the ' + P.phaseFor(goal, P.todayISO()).name + ' phase. Your cleanest starting point is “' + first.label + '.” What would make today easier to follow through on?';
  }
  function renderCoachMessages(typing) {
    var messages = (state.chats[currentGoalId || 'none'] || []).slice(-20);
    $('coach-messages').innerHTML = messages.map(function (message) {
      var actions = (message.actions || []).map(function (item) { return '<button class="prompt-chip" type="button" data-action="coach-response" data-coach-action="' + attr(item.action) + '">' + esc(item.label) + '</button>'; }).join('');
      return '<div class="message ' + (message.role === 'user' ? 'user' : '') + '"><span class="message-avatar">' + (message.role === 'user' ? 'YO' : '✦') + '</span><div><div class="message-bubble">' + esc(message.text) + '</div>' + (actions ? '<div class="coach-prompts" style="padding:.45rem 0">' + actions + '</div>' : '') + '<span class="message-meta">' + (message.role === 'user' ? 'YOU' : message.source === 'ai' ? 'GPT-5.6 COACH' : 'MOMENTUM COACH · OFFLINE') + '</span></div></div>';
    }).join('') + (typing ? '<div class="message"><span class="message-avatar">✦</span><div class="message-bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>' : '');
    $('coach-messages').scrollTop = $('coach-messages').scrollHeight;
  }
  async function submitCoach(text) {
    text = String(text || '').trim();
    if (!text) return;
    if (!$('app-shell').hidden && currentRoute !== 'coach') routeTo('coach');
    var key = currentGoalId || 'none';
    if (!state.chats[key]) state.chats[key] = [];
    state.chats[key].push({ role: 'user', text: text });
    $('coach-input').value = '';
    renderCoachMessages(true);
    $('coach-form').querySelector('button').disabled = true;
    var result, source = 'local';
    try {
      result = await requestAICoach(text, goalById(currentGoalId), state.chats[key]);
      source = 'ai';
    } catch (error) {
      result = P.coachFallback(goalById(currentGoalId), text, state.taskChecks);
    }
    state.chats[key].push({ role: 'assistant', text: result.message, actions: result.actions || [], source: source });
    state.chats[key] = state.chats[key].slice(-20);
    saveState();
    $('coach-form').querySelector('button').disabled = false;
    renderCoachMessages(false);
  }
  async function requestAICoach(message, goal, messages) {
    var context = goal ? {
      title: goal.title, why: goal.why, category: goal.category, method: P.methodFor(goal).label,
      level: goal.level, minutesPerDay: goal.minutesPerDay, daysPerWeek: goal.daysPerWeek,
      startDate: goal.startDate, deadline: goal.deadline, plan: goal.plan,
      currentPhase: P.phaseFor(goal, P.todayISO()), stats: P.getStats(goal, state.taskChecks),
      todayTasks: P.getDailyTasks(goal, P.todayISO()).map(function (item) { return { label: item.label, minutes: item.minutes, done: !!state.taskChecks[P.taskKey(goal.id, P.todayISO(), item.id)] }; })
    } : null;
    var response = await fetch('./api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'chat', message: message, goal: context, history: messages.slice(-6).map(function (item) { return { role: item.role, text: item.text }; }) }) });
    if (!response.ok) throw new Error('AI endpoint unavailable');
    var body = await response.json();
    if (!body || !body.message) throw new Error('Invalid coach response');
    return body;
  }

  function handleCoachAction(action) {
    if (action === 'create_goal') return openWizard();
    if (action === 'open_today') return routeTo('today');
    if (action === 'open_goal') return routeToGoal(currentGoalId);
    if (action === 'rebalance') return rebalanceGoal(currentGoalId, true);
  }

  function renderGoalDetail() {
    var goal = goalById(currentGoalId);
    if (!goal) { routeTo('home'); return; }
    var cfg = P.configFor(goal.category), stats = P.getStats(goal, state.taskChecks), phase = P.phaseFor(goal, P.todayISO());
    var timeline = clampPercent((P.diffDays(goal.startDate, P.todayISO()) + 1) / Math.max(1, P.diffDays(goal.startDate, goal.deadline) + 1) * 100);
    var tasks = P.getDailyTasks(goal, P.todayISO()), first = tasks.find(function (item) { return !state.taskChecks[P.taskKey(goal.id, P.todayISO(), item.id)]; }) || tasks[0];
    var heatmap = '', cursor = goal.startDate, today = P.todayISO(), maxCells = 560, count = 0;
    while (cursor <= goal.deadline && count < maxCells) {
      var progress = cursor <= today ? P.dayProgress(goal, cursor, state.taskChecks) : 0;
      var className = progress === 1 ? 'hit' : progress > 0 ? 'partial' : cursor < today ? 'missed' : '';
      heatmap += '<button type="button" class="heat-cell ' + className + (cursor === today ? ' today' : '') + '" ' + (cursor <= today ? 'data-action="toggle-day" data-goal-id="' + attr(goal.id) + '" data-date="' + cursor + '"' : 'disabled') + ' title="' + attr(formatDate(cursor) + ' · ' + Math.round(progress * 100) + '% complete') + '"></button>';
      cursor = P.addDays(cursor, 1); count++;
    }
    var phases = goal.plan.phases.map(function (item, index) {
      var isCurrent = item.name === phase.name;
      return '<div class="phase-row ' + (isCurrent ? 'current' : '') + '"><span class="phase-num">' + (isCurrent ? '✓' : '0' + (index + 1)) + '</span><div class="phase-copy"><b>' + esc(item.name) + '</b><span>' + esc(item.outcome) + '</span></div><span class="phase-time">' + esc(item.dateLabel) + '</span></div>';
    }).join('');
    $('goal-detail-content').innerHTML =
      '<button class="goal-back" type="button" data-route="home">← All systems</button>' +
      '<header class="goal-hero" style="--goal-color:' + cfg.color + '"><div class="goal-hero-main"><div class="goal-eyebrow"><i></i><span>' + esc(goal.category) + ' · ' + esc(P.methodFor(goal).label) + '</span></div><h2 id="goal-heading">' + esc(goal.title) + '</h2><p>' + esc(goal.why || goal.plan.summary) + '</p></div><div class="goal-actions"><button class="button button-quiet" type="button" data-action="edit-goal" data-goal-id="' + attr(goal.id) + '">Adjust system</button><button class="button button-quiet danger-button" type="button" data-action="delete-goal" data-goal-id="' + attr(goal.id) + '">Delete</button></div></header>' +
      '<div class="goal-stat-grid"><div class="goal-stat"><b>' + stats.currentStreak + '</b><span>current streak</span></div><div class="goal-stat"><b>' + stats.bestStreak + '</b><span>best streak</span></div><div class="goal-stat"><b>' + stats.taskRate + '%</b><span>tasks complete</span></div><div class="goal-stat"><b>' + timeline + '%</b><span>timeline elapsed</span></div></div>' +
      '<div class="goal-layout" style="--goal-color:' + cfg.color + '"><div>' +
        '<section class="panel"><div class="panel-head"><div><h3>Proof of practice</h3><p>Click any past or current day to mark the full plan.</p></div><span>' + stats.daysHit + ' complete days</span></div><div class="full-heatmap-wrap"><div class="full-heatmap">' + heatmap + '</div></div><div class="heat-legend"><span>Not started</span><i></i><i class="partial"></i><i class="hit"></i><span>Complete</span></div></section>' +
        '<section class="panel"><div class="panel-head"><div><h3>Your roadmap</h3><p>' + esc(goal.plan.summary) + '</p></div><span>' + goal.plan.totalWeeks + ' weeks</span></div><div class="phase-list">' + phases + '</div></section>' +
      '</div><aside>' +
        '<section class="panel next-action"><span class="overline">NEXT BEST ACTION</span><h3>' + esc(first.label) + '</h3><p>' + esc(first.meta) + ' · ' + first.minutes + ' minutes</p><button class="button button-primary" type="button" data-route="today">Open today’s plan →</button></section>' +
        '<section class="panel"><div class="panel-head"><div><h3>System design</h3><p>The constraints your plan protects.</p></div></div><div class="system-details"><div class="system-detail"><span>Path</span><b>' + esc(P.methodFor(goal).label) + '</b></div><div class="system-detail"><span>Cadence</span><b>' + goal.daysPerWeek + ' days / week</b></div><div class="system-detail"><span>Session</span><b>' + goal.minutesPerDay + ' minutes</b></div><div class="system-detail"><span>Level</span><b>' + esc(goal.level) + '</b></div><div class="system-detail"><span>Deadline</span><b>' + formatDate(goal.deadline) + '</b></div><div class="system-detail"><span>Success looks like</span><b>' + esc(goal.plan.successMetric) + '</b></div></div>' + (goal.category === 'Fitness' ? '<p class="disclaimer">General educational guidance only. Use pain-free movement and seek qualified professional advice for injuries, medical concerns, or nutrition needs.</p>' : '') + '</section>' +
      '</aside></div>';
  }

  function toggleTask(goalId, date, taskId) {
    var key = P.taskKey(goalId, date, taskId);
    if (state.taskChecks[key]) delete state.taskChecks[key]; else state.taskChecks[key] = true;
    saveState(); renderCurrent();
  }
  function toggleWholeDay(goalId, date) {
    var goal = goalById(goalId); if (!goal) return;
    var tasks = P.getDailyTasks(goal, date), allDone = tasks.every(function (item) { return state.taskChecks[P.taskKey(goalId, date, item.id)]; });
    tasks.forEach(function (item) { var key = P.taskKey(goalId, date, item.id); if (allDone) delete state.taskChecks[key]; else state.taskChecks[key] = true; });
    saveState(); renderCurrent(); showToast(allDone ? 'Day reopened.' : 'Day marked complete.', 'success');
  }
  function renderCurrent() { renderSidebar(); if (currentRoute === 'home') renderHome(); else if (currentRoute === 'today') renderToday(); else if (currentRoute === 'goal') renderGoalDetail(); else if (currentRoute === 'coach') renderCoach(); }
  function clampPercent(value) { return Math.min(100, Math.max(0, Math.round(value))); }

  function openWizard(goal) {
    lastFocus = document.activeElement;
    wizardEditId = goal ? goal.id : null;
    wizardStep = 1;
    var today = P.todayISO();
    wizardData = goal ? {
      title: goal.title, why: goal.why, category: goal.category, method: goal.method, level: goal.level,
      daysPerWeek: goal.daysPerWeek, minutesPerDay: goal.minutesPerDay, startDate: goal.startDate,
      deadline: goal.deadline, constraints: goal.constraints || '', priority: goal.priority
    } : { title: '', why: '', category: 'Fitness', method: 'hybrid', level: 'Beginner', daysPerWeek: 4, minutesPerDay: 30, startDate: today, deadline: P.addDays(today, 84), constraints: '', priority: 'High' };
    wizardPlan = goal ? goal.plan : null;
    $('goal-title').value = wizardData.title;
    $('goal-why').value = wizardData.why;
    $('goal-start').value = wizardData.startDate;
    $('goal-deadline').value = wizardData.deadline;
    $('goal-constraints').value = wizardData.constraints;
    $('minutes-range').value = wizardData.minutesPerDay;
    $('minutes-value').textContent = wizardData.minutesPerDay;
    renderCategoryOptions(); renderMethodOptions(); renderSegments(); updateWizard();
    $('goal-modal').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('goal-title').focus(); }, 50);
  }
  function closeWizard() { $('goal-modal').hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function renderCategoryOptions() {
    $('category-options').innerHTML = Object.keys(P.CATEGORIES).map(function (key) { var cfg = P.CATEGORIES[key]; return '<button class="choice-card ' + (wizardData.category === key ? 'selected' : '') + '" type="button" data-category="' + key + '"><span>' + cfg.icon + '</span><b>' + esc(cfg.label) + '</b><small>' + esc(cfg.note) + '</small></button>'; }).join('');
    qsa('[data-category]', $('category-options')).forEach(function (button) { button.addEventListener('click', function () { wizardData.category = button.getAttribute('data-category'); wizardData.method = P.configFor(wizardData.category).methods[0].id; renderCategoryOptions(); renderMethodOptions(); }); });
  }
  function renderMethodOptions() {
    var methods = P.configFor(wizardData.category).methods;
    if (!methods.some(function (item) { return item.id === wizardData.method; })) wizardData.method = methods[0].id;
    $('method-options').innerHTML = methods.map(function (method) { return '<button class="choice-card ' + (wizardData.method === method.id ? 'selected' : '') + '" type="button" data-method="' + attr(method.id) + '"><span>' + method.icon + '</span><b>' + esc(method.label) + '</b><small>' + esc(method.description) + '</small></button>'; }).join('');
    qsa('[data-method]', $('method-options')).forEach(function (button) { button.addEventListener('click', function () { wizardData.method = button.getAttribute('data-method'); renderMethodOptions(); }); });
  }
  function renderSegments() {
    $('level-options').innerHTML = ['Beginner', 'Intermediate', 'Advanced'].map(function (level) { return '<button type="button" class="' + (wizardData.level === level ? 'selected' : '') + '" data-level="' + level + '">' + level + '</button>'; }).join('');
    $('days-options').innerHTML = [3, 4, 5, 6, 7].map(function (days) { return '<button type="button" class="' + (Number(wizardData.daysPerWeek) === days ? 'selected' : '') + '" data-days="' + days + '">' + days + '</button>'; }).join('');
    qsa('[data-level]', $('level-options')).forEach(function (button) { button.addEventListener('click', function () { wizardData.level = button.getAttribute('data-level'); renderSegments(); }); });
    qsa('[data-days]', $('days-options')).forEach(function (button) { button.addEventListener('click', function () { wizardData.daysPerWeek = Number(button.getAttribute('data-days')); renderSegments(); }); });
  }
  function captureWizardFields() {
    wizardData.title = $('goal-title').value.trim(); wizardData.why = $('goal-why').value.trim();
    wizardData.startDate = $('goal-start').value; wizardData.deadline = $('goal-deadline').value;
    wizardData.constraints = $('goal-constraints').value.trim(); wizardData.minutesPerDay = Number($('minutes-range').value);
  }
  function validateStepOne() {
    captureWizardFields();
    if (!wizardData.title) { showToast('Give your goal a clear outcome.', 'error'); $('goal-title').focus(); return false; }
    if (!wizardData.startDate || !wizardData.deadline) { showToast('Choose a start date and target date.', 'error'); return false; }
    if (wizardData.deadline < wizardData.startDate) { showToast('Your target date must follow the start date.', 'error'); return false; }
    if (P.diffDays(wizardData.startDate, wizardData.deadline) < 6) { showToast('Give the system at least seven days to create a meaningful progression.', 'error'); return false; }
    return true;
  }
  function wizardBack() { if (wizardStep === 1) closeWizard(); else { wizardStep--; updateWizard(); } }
  function wizardNext() {
    if (wizardStep === 1 && !validateStepOne()) return;
    captureWizardFields();
    if (wizardStep < 3) { wizardStep++; updateWizard(); if (wizardStep === 3) preparePlanPreview(); }
    else saveWizardGoal();
  }
  function updateWizard() {
    qsa('.wizard-step').forEach(function (step) { step.classList.toggle('active', Number(step.getAttribute('data-step')) === wizardStep); });
    $('wizard-progress-fill').style.width = (wizardStep / 3 * 100) + '%';
    $('wizard-progress-label').textContent = 'Step ' + wizardStep + ' of 3 · ' + (wizardStep === 1 ? 'Outcome' : wizardStep === 2 ? 'Path' : 'Roadmap');
    $('wizard-title').textContent = wizardStep === 1 ? (wizardEditId ? 'Refine your outcome.' : 'What are you becoming?') : wizardStep === 2 ? 'How will you get there?' : 'Your system is ready.';
    $('wizard-back').textContent = wizardStep === 1 ? 'Cancel' : 'Back';
    $('wizard-next').textContent = wizardStep === 1 ? 'Choose my path →' : wizardStep === 2 ? 'Build my roadmap →' : wizardEditId ? 'Save changes' : 'Create my system';
    $('wizard-hint').textContent = wizardStep === 3 ? 'You can ask the coach to adapt this at any time.' : 'You can change this later.';
  }
  async function preparePlanPreview() {
    captureWizardFields();
    $('plan-generating').hidden = false; $('plan-preview').hidden = true; $('wizard-next').disabled = true;
    var previewGoal = Object.assign({ id: wizardEditId || 'preview' }, wizardData);
    var localPlan = P.createPlan(previewGoal);
    wizardPlan = localPlan;
    await new Promise(function (resolve) { setTimeout(resolve, 450); });
    renderPlanPreview(localPlan, 'local');
    $('wizard-next').disabled = false;
    try {
      var response = await fetch('./api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'plan', goal: wizardData, localPlan: localPlan }) });
      if (!response.ok) return;
      var body = await response.json();
      if (!body.plan) return;
      wizardPlan = mergeAIPlan(localPlan, body.plan);
      renderPlanPreview(wizardPlan, 'ai');
    } catch (error) { /* local plan is intentionally complete */ }
  }
  function mergeAIPlan(local, ai) {
    var merged = Object.assign({}, local);
    if (ai.summary) merged.summary = ai.summary;
    if (ai.successMetric) merged.successMetric = ai.successMetric;
    if (ai.coachNote) merged.coachNote = ai.coachNote;
    if (Array.isArray(ai.phases) && ai.phases.length === local.phases.length) merged.phases = local.phases.map(function (phase, index) { return Object.assign({}, phase, { name: ai.phases[index].name || phase.name, outcome: ai.phases[index].outcome || phase.outcome }); });
    merged.generatedBy = 'GPT-5.6 + Momentum engine';
    return merged;
  }
  function renderPlanPreview(plan, source) {
    $('plan-generating').hidden = true; $('plan-preview').hidden = false;
    $('plan-preview').innerHTML = '<h3>' + esc(wizardData.title) + '</h3><p>' + esc(plan.summary) + '</p><div class="preview-summary"><div><b>' + plan.totalWeeks + ' weeks</b><span>timeline</span></div><div><b>' + wizardData.daysPerWeek + ' × weekly</b><span>cadence</span></div><div><b>' + wizardData.minutesPerDay + ' minutes</b><span>per session</span></div></div><div class="preview-phases">' + plan.phases.map(function (phase, index) { return '<div class="preview-phase"><span>0' + (index + 1) + '</span><div><b>' + esc(phase.name) + '</b><small>' + esc(phase.outcome) + '</small></div><small>' + esc(phase.dateLabel) + '</small></div>'; }).join('') + '</div><span class="ai-source">' + (source === 'ai' ? '✦ Enhanced with GPT-5.6' : '✓ Instant private plan · AI enhancement available when connected') + '</span>';
  }
  function saveWizardGoal() {
    captureWizardFields();
    var existing = goalById(wizardEditId);
    var goal = P.createGoal(Object.assign({}, wizardData, existing ? { id: existing.id, createdAt: existing.createdAt, adaptations: existing.adaptations || 0 } : {}));
    goal.plan = wizardPlan || goal.plan;
    if (existing) state.goals = state.goals.map(function (item) { return item.id === existing.id ? goal : item; });
    else state.goals.push(goal);
    currentGoalId = goal.id; state.selectedGoalId = goal.id; state.demo = false; saveState(); closeWizard(); openApp('goal');
    showToast(existing ? 'System updated.' : 'Your system is live. Today has a clear first step.', 'success');
  }

  function rebalanceGoal(id, fromCoach) {
    var goal = goalById(id); if (!goal) return;
    var before = goal.minutesPerDay, updated = P.rebalanceGoal(goal);
    state.goals = state.goals.map(function (item) { return item.id === id ? updated : item; });
    saveState();
    if (fromCoach) {
      var key = id; if (!state.chats[key]) state.chats[key] = [];
      state.chats[key].push({ role: 'assistant', text: 'I reduced future sessions from ' + before + ' to ' + updated.minutesPerDay + ' minutes while preserving the same deadline and three-phase direction. Run this lighter version for three sessions, then judge it by how easy it is to restart.', source: 'local', actions: [{ label: 'Open today', action: 'open_today' }] });
      saveState(); renderCoach();
    } else { renderCurrent(); }
    showToast('System lightened to ' + updated.minutesPerDay + ' minutes per session.', 'success');
  }
  function deleteGoal(id) {
    var goal = goalById(id); if (!goal) return;
    if (!window.confirm('Delete “' + goal.title + '” and its progress history? This cannot be undone.')) return;
    state.goals = state.goals.filter(function (item) { return item.id !== id; });
    Object.keys(state.taskChecks).forEach(function (key) { if (key.indexOf(id + '|') === 0) delete state.taskChecks[key]; });
    delete state.chats[id]; currentGoalId = state.goals[0] ? state.goals[0].id : null; state.selectedGoalId = currentGoalId; saveState(); routeTo('home'); showToast('Goal and its local history deleted.', 'error');
  }
  function showToast(message, type) { var toast = $('toast'); toast.textContent = message; toast.className = 'toast show ' + (type || ''); clearTimeout(toast._timer); toast._timer = setTimeout(function () { toast.className = 'toast'; }, 3200); }

  boot();
})();
