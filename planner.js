(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentumPlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CATEGORIES = {
    Fitness: {
      icon: '◒', color: '#c7f36b', label: 'Fitness', note: 'Strength, movement, energy',
      methods: [
        { id: 'gym', icon: '▰', label: 'Gym strength', description: 'Progressive resistance with gym equipment' },
        { id: 'calisthenics', icon: '◇', label: 'Calisthenics', description: 'Bodyweight strength and movement skill' },
        { id: 'hybrid', icon: '⌁', label: 'Hybrid', description: 'Combine weights and bodyweight work' }
      ],
      phases: [
        ['Foundation', 'Learn clean movement patterns and establish a recoverable baseline.'],
        ['Build', 'Add controlled volume and progressive difficulty.'],
        ['Perform', 'Consolidate strength and demonstrate visible progress.']
      ]
    },
    Learning: {
      icon: '⌘', color: '#8daae8', label: 'Learning', note: 'Skills, languages, knowledge',
      methods: [
        { id: 'structured', icon: '≡', label: 'Structured path', description: 'Lessons in a deliberate sequence' },
        { id: 'project', icon: '↗', label: 'Project-first', description: 'Learn by building something real' },
        { id: 'practice', icon: '◎', label: 'Deliberate practice', description: 'Target weak points with feedback loops' }
      ],
      phases: [
        ['Fundamentals', 'Build the smallest vocabulary and mental models needed to begin.'],
        ['Applied practice', 'Use retrieval, drills, and increasingly realistic exercises.'],
        ['Proof of skill', 'Complete and explain an independent capstone.']
      ]
    },
    Career: {
      icon: '↗', color: '#e4b967', label: 'Career', note: 'Work, portfolio, opportunities',
      methods: [
        { id: 'portfolio', icon: '▦', label: 'Portfolio sprint', description: 'Create evidence people can evaluate' },
        { id: 'skill-stack', icon: '△', label: 'Skill stack', description: 'Strengthen a high-leverage capability' },
        { id: 'network-ship', icon: '⌁', label: 'Network & ship', description: 'Build in public and create conversations' }
      ],
      phases: [
        ['Direction', 'Clarify the target, evidence gap, and opportunity landscape.'],
        ['Build signal', 'Create work that makes the desired capability visible.'],
        ['Ship & connect', 'Publish the evidence and start useful conversations.']
      ]
    },
    Creative: {
      icon: '✦', color: '#d59ae6', label: 'Creative', note: 'Writing, music, making',
      methods: [
        { id: 'daily-craft', icon: '✎', label: 'Daily craft', description: 'Small, consistent creative reps' },
        { id: 'project-sprint', icon: '□', label: 'Project sprint', description: 'Move one defined work to completion' },
        { id: 'publish-loop', icon: '◉', label: 'Publish loop', description: 'Create, share, learn, and repeat' }
      ],
      phases: [
        ['Explore', 'Set constraints, gather references, and find the strongest direction.'],
        ['Produce', 'Protect output time and finish complete iterations.'],
        ['Publish', 'Polish, release, and capture feedback for the next cycle.']
      ]
    },
    Wellbeing: {
      icon: '≈', color: '#75c79a', label: 'Wellbeing', note: 'Mindfulness, sleep, balance',
      methods: [
        { id: 'gentle', icon: '≈', label: 'Gentle routine', description: 'A low-friction daily anchor' },
        { id: 'mind-body', icon: '◌', label: 'Mind + body', description: 'Pair reflection with calming movement' },
        { id: 'reflection', icon: '☷', label: 'Reflection practice', description: 'Notice patterns and make one adjustment' }
      ],
      phases: [
        ['Stabilize', 'Create a small reliable anchor and notice current patterns.'],
        ['Strengthen', 'Increase consistency without making the routine fragile.'],
        ['Sustain', 'Build a maintenance pattern for difficult weeks.']
      ]
    },
    Finance: {
      icon: '◫', color: '#78c9c5', label: 'Finance', note: 'Saving, debt, money systems',
      methods: [
        { id: 'automate', icon: '↻', label: 'Automate & review', description: 'Remove repeated money decisions' },
        { id: 'debt', icon: '↓', label: 'Debt sprint', description: 'Prioritize and track a payoff sequence' },
        { id: 'foundations', icon: '▤', label: 'Money foundations', description: 'Build visibility, buffer, and habits' }
      ],
      phases: [
        ['Visibility', 'Map the current picture and choose the metric that matters.'],
        ['Systemize', 'Automate the helpful defaults and remove avoidable leakage.'],
        ['Compound', 'Review results and strengthen the next highest-leverage move.']
      ]
    },
    Other: {
      icon: '＋', color: '#c8ccc5', label: 'Something else', note: 'Design a custom system',
      methods: [
        { id: 'milestone', icon: '◇', label: 'Milestone sprint', description: 'Work backward from concrete outcomes' },
        { id: 'practice', icon: '◎', label: 'Daily practice', description: 'Improve through consistent repetitions' },
        { id: 'hybrid', icon: '⌁', label: 'Hybrid system', description: 'Mix milestones with daily practice' }
      ],
      phases: [
        ['Define', 'Clarify success, constraints, and the first verifiable result.'],
        ['Execute', 'Complete the highest-leverage work in short feedback loops.'],
        ['Deliver', 'Finish, evaluate, and make the result visible.']
      ]
    }
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function todayISO() { return toISO(new Date()); }
  function parseISO(iso) {
    var p = String(iso || '').split('-').map(Number);
    return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1, 12, 0, 0);
  }
  function addDays(iso, amount) { var d = parseISO(iso); d.setDate(d.getDate() + amount); return toISO(d); }
  function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
  function uid() { return 'goal_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
  function configFor(category) { return CATEGORIES[category] || CATEGORIES.Other; }
  function methodFor(goal) {
    var methods = configFor(goal.category).methods;
    return methods.find(function (item) { return item.id === goal.method; }) || methods[0];
  }
  function formatShort(iso) { return parseISO(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' }); }

  function createPlan(goal) {
    var totalDays = Math.max(1, diffDays(goal.startDate, goal.deadline) + 1);
    var totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    var cfg = configFor(goal.category);
    var firstEnd = Math.max(1, Math.round(totalDays * 0.24));
    var secondEnd = Math.max(firstEnd, Math.round(totalDays * 0.72));
    secondEnd = Math.min(totalDays, secondEnd);
    var bounds = [[1, firstEnd], [Math.min(firstEnd + 1, totalDays), secondEnd], [Math.min(secondEnd + 1, totalDays), totalDays]];
    var phases = cfg.phases.map(function (phase, index) {
      var startDay = bounds[index][0], endDay = Math.max(startDay, bounds[index][1]);
      return {
        name: phase[0], outcome: phase[1], startDay: startDay, endDay: endDay,
        dateLabel: formatShort(addDays(goal.startDate, startDay - 1)) + '–' + formatShort(addDays(goal.startDate, endDay - 1))
      };
    });
    var method = methodFor(goal);
    return {
      summary: buildSummary(goal, method, totalWeeks),
      successMetric: successMetric(goal),
      totalDays: totalDays,
      totalWeeks: totalWeeks,
      phases: phases,
      cadence: goal.daysPerWeek + ' focused days · ' + goal.minutesPerDay + ' min/session',
      methodLabel: method.label,
      generatedBy: 'Momentum planning engine',
      coachNote: 'Protect consistency first. Progress the difficulty only when the current version feels controlled.'
    };
  }

  function buildSummary(goal, method, weeks) {
    var prefix = goal.category === 'Fitness' ? 'A progressive' : goal.category === 'Learning' ? 'An applied' : 'A focused';
    return prefix + ' ' + weeks + '-week ' + method.label.toLowerCase() + ' system, shaped around ' + goal.minutesPerDay + ' minutes on ' + goal.daysPerWeek + ' days each week.';
  }

  function successMetric(goal) {
    if (goal.category === 'Fitness') return 'Complete planned sessions and improve one controlled performance marker.';
    if (goal.category === 'Learning') return 'Produce a capstone you can complete and explain without step-by-step help.';
    if (goal.category === 'Career') return 'Publish credible evidence of the capability or outcome you want to be hired for.';
    if (goal.category === 'Creative') return 'Finish and share a complete piece, not only fragments or practice.';
    if (goal.category === 'Wellbeing') return 'Sustain the routine through an ordinary and a difficult week.';
    if (goal.category === 'Finance') return 'Move the chosen money metric in the intended direction for four reviews.';
    return 'Finish a result that another person could verify.';
  }

  function phaseFor(goal, date) {
    var plan = goal.plan || createPlan(goal);
    var day = clamp(diffDays(goal.startDate, date) + 1, 1, plan.totalDays || 1);
    return plan.phases.find(function (phase) { return day >= phase.startDay && day <= phase.endDay; }) || plan.phases[plan.phases.length - 1];
  }

  function activeWeekdays(daysPerWeek) {
    var map = { 1: [1], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
    return map[clamp(Number(daysPerWeek) || 3, 1, 7)];
  }

  function sessionNumber(goal, date) {
    var count = 0, cursor = goal.startDate, active = activeWeekdays(goal.daysPerWeek);
    while (cursor <= date && cursor <= goal.deadline) {
      if (active.indexOf(parseISO(cursor).getDay()) >= 0) count++;
      cursor = addDays(cursor, 1);
    }
    return Math.max(1, count);
  }

  function task(id, label, meta, minutes) { return { id: id, label: label, meta: meta, minutes: minutes }; }
  function splitMinutes(total, weights) {
    var used = 0;
    return weights.map(function (weight, index) {
      var value = index === weights.length - 1 ? total - used : Math.max(2, Math.round(total * weight));
      used += value; return Math.max(2, value);
    });
  }

  function getDailyTasks(goal, date) {
    date = date || todayISO();
    var active = activeWeekdays(goal.daysPerWeek).indexOf(parseISO(date).getDay()) >= 0;
    var phase = phaseFor(goal, date);
    var total = Number(goal.minutesPerDay) || 30;
    if (!active) return recoveryTasks(goal, date, Math.min(15, total));
    if (goal.category === 'Fitness') return fitnessTasks(goal, date, phase, total);
    if (goal.category === 'Learning') return learningTasks(goal, date, phase, total);
    if (goal.category === 'Career') return careerTasks(goal, date, phase, total);
    if (goal.category === 'Creative') return creativeTasks(goal, date, phase, total);
    if (goal.category === 'Wellbeing') return wellbeingTasks(goal, date, phase, total);
    if (goal.category === 'Finance') return financeTasks(goal, date, phase, total);
    return generalTasks(goal, date, phase, total);
  }

  function recoveryTasks(goal, date, total) {
    if (goal.category === 'Fitness') return [
      task('recovery_move', 'Easy mobility or a relaxed walk', 'Recovery · keep the chain gentle', Math.max(8, total - 3)),
      task('recovery_note', 'Check sleep, soreness, and tomorrow’s setup', 'Two-minute recovery check', 3)
    ];
    if (goal.category === 'Learning') return [task('light_recall', 'Recall three ideas without looking at your notes', 'Light review · no new material', 8), task('queue_next', 'Write the first question for your next session', 'Make starting easy', 2)];
    return [task('maintain', 'Complete the minimum viable version of your practice', 'Maintenance day', Math.max(8, total - 2)), task('prepare', 'Prepare the first step for your next focused session', 'Reduce tomorrow’s friction', 2)];
  }

  function fitnessTasks(goal, date, phase, total) {
    var n = sessionNumber(goal, date), slot = (n - 1) % 3;
    var level = goal.level || 'Beginner';
    var sets = level === 'Advanced' ? '4 controlled sets' : level === 'Intermediate' ? '3–4 controlled sets' : '2–3 controlled sets';
    var method = goal.method || 'hybrid';
    var gym = [
      ['Squat or leg press · horizontal push · row', 'dead bug or loaded carry'],
      ['Hip hinge · overhead press · pulldown', 'side plank or anti-rotation hold'],
      ['Split squat · incline press · cable or chest-supported row', 'farmer carry or slow mountain climber']
    ];
    var body = [
      ['Squat progression · push-up progression · body row', 'hollow hold or dead bug'],
      ['Lunge progression · pike push-up · assisted pull-up', 'side plank progression'],
      ['Single-leg squat drill · dip or close push-up · row/pull-up', 'bear crawl or hollow rocks']
    ];
    var hybrid = [
      ['Goblet squat · push-up or bench press · row', 'dead bug or loaded carry'],
      ['Romanian deadlift · pike or overhead press · pull-up/pulldown', 'side plank progression'],
      ['Split squat · incline press · body row', 'farmer carry or hollow hold']
    ];
    var movements = method === 'gym' ? gym[slot] : method === 'calisthenics' ? body[slot] : hybrid[slot];
    var mins = splitMinutes(total, [.16, .58, .16, .1]);
    var progression = phase.name === 'Foundation' ? 'Leave 3 good reps in reserve' : phase.name === 'Build' ? 'Add one rep or a small load if form stays clean' : 'Use your strongest clean variation and record the result';
    return [
      task('warmup', 'Raise temperature, then prepare today’s joints', 'Warm-up · easy pace', mins[0]),
      task('main_' + slot, movements[0] + ' — ' + sets, 'Main work · ' + progression, mins[1]),
      task('core_' + slot, movements[1] + ' — 2–3 quality rounds', 'Core + control', mins[2]),
      task('log', 'Record reps, effort, and one recovery note', 'Close the feedback loop', mins[3])
    ];
  }

  function learningTasks(goal, date, phase, total) {
    var n = sessionNumber(goal, date), mins = splitMinutes(total, [.18, .5, .24, .08]);
    var focus = phase.name === 'Fundamentals' ? 'one foundational concept' : phase.name === 'Applied practice' ? 'one realistic problem slightly above comfort' : 'the next capstone slice';
    var methodText = goal.method === 'project' ? 'Apply it immediately inside your project' : goal.method === 'practice' ? 'Target the weakest sub-skill with a scored drill' : 'Complete one focused lesson and its worked example';
    return [
      task('retrieve', 'Recall yesterday’s ideas before opening notes', 'Active recall · session ' + n, mins[0]),
      task('learn', 'Study ' + focus + ' with full attention', methodText, mins[1]),
      task('apply', 'Produce an answer, exercise, or artifact from memory', 'No passive rereading', mins[2]),
      task('explain', 'Write what changed in your understanding and the next question', 'Two-sentence learning log', mins[3])
    ];
  }

  function careerTasks(goal, date, phase, total) {
    var mins = splitMinutes(total, [.12, .65, .15, .08]);
    var main = phase.name === 'Direction' ? 'Analyze one strong example and define today’s evidence gap' : phase.name === 'Build signal' ? 'Create one reviewable slice of portfolio evidence' : 'Publish, pitch, or send one thoughtful outreach';
    return [task('target', 'Name the one visible result for this session', 'Scope before effort', mins[0]), task('build', main, phase.outcome, mins[1]), task('review', 'Review it from the audience or hiring manager’s perspective', 'Clarity + credibility', mins[2]), task('next', 'Write tomorrow’s first action', 'Protect momentum', mins[3])];
  }

  function creativeTasks(goal, date, phase, total) {
    var mins = splitMinutes(total, [.1, .7, .14, .06]);
    var main = phase.name === 'Explore' ? 'Make one complete study under a clear constraint' : phase.name === 'Produce' ? 'Create the next complete section before editing' : 'Polish the highest-impact weakness and prepare the release';
    return [task('open', 'Open the work and remove one distraction', 'Starting ritual', mins[0]), task('make', main, 'Creation before judgment', mins[1]), task('review', 'Review once for the single most important improvement', 'One editing pass', mins[2]), task('bookmark', 'Leave a note for the next starting point', 'Close with direction', mins[3])];
  }

  function wellbeingTasks(goal, date, phase, total) {
    var mins = splitMinutes(total, [.25, .55, .2]);
    return [task('arrive', 'Pause and notice your current state without fixing it', 'Check in', mins[0]), task('practice', goal.method === 'mind-body' ? 'Pair calm breathing with gentle, comfortable movement' : goal.method === 'reflection' ? 'Write freely, then circle the one pattern that matters' : 'Complete your chosen calming routine at an easy pace', phase.name + ' practice', mins[1]), task('adjust', 'Choose one small condition that will help tomorrow', 'Make the environment kinder', mins[2])];
  }

  function financeTasks(goal, date, phase, total) {
    var mins = splitMinutes(total, [.18, .62, .2]);
    var main = phase.name === 'Visibility' ? 'Categorize recent activity and update the one metric you chose' : phase.name === 'Systemize' ? 'Complete one automation, negotiation, cancellation, or payoff action' : 'Review the trend and move the next planned amount';
    return [task('check', 'Open the numbers and record the current snapshot', 'Facts first', mins[0]), task('money_action', main, phase.outcome, mins[1]), task('close', 'Record the decision and schedule the next review', 'No repeated decision', mins[2])];
  }

  function generalTasks(goal, date, phase, total) {
    var mins = splitMinutes(total, [.12, .68, .14, .06]);
    return [task('define', 'Define the smallest verifiable finish for today', 'Make success visible', mins[0]), task('execute', 'Work on the highest-leverage part of: ' + goal.title, phase.outcome, mins[1]), task('verify', 'Review the result against today’s finish line', 'Evidence, not effort', mins[2]), task('queue', 'Write the next starting action', 'Reduce tomorrow’s friction', mins[3])];
  }

  function taskKey(goalId, date, taskId) { return goalId + '|' + date + '|' + taskId; }
  function dayProgress(goal, date, taskChecks) {
    var tasks = getDailyTasks(goal, date);
    if (!tasks.length) return 0;
    var complete = tasks.filter(function (item) { return !!taskChecks[taskKey(goal.id, date, item.id)]; }).length;
    return complete / tasks.length;
  }

  function getStats(goal, taskChecks, asOf) {
    asOf = asOf || todayISO();
    var end = goal.deadline < asOf ? goal.deadline : asOf;
    if (end < goal.startDate) return { rate: 0, daysHit: 0, currentStreak: 0, bestStreak: 0, elapsedDays: 0, taskRate: 0 };
    var cursor = goal.startDate, daysHit = 0, elapsed = 0, totalTasks = 0, completedTasks = 0, running = 0, best = 0;
    while (cursor <= end) {
      var tasks = getDailyTasks(goal, cursor), complete = tasks.filter(function (item) { return !!taskChecks[taskKey(goal.id, cursor, item.id)]; }).length;
      totalTasks += tasks.length; completedTasks += complete; elapsed++;
      if (complete === tasks.length && tasks.length) { daysHit++; running++; best = Math.max(best, running); } else running = 0;
      cursor = addDays(cursor, 1);
    }
    var streakCursor = end;
    if (streakCursor === asOf && dayProgress(goal, streakCursor, taskChecks) < 1) streakCursor = addDays(streakCursor, -1);
    var current = 0;
    while (streakCursor >= goal.startDate && dayProgress(goal, streakCursor, taskChecks) === 1) { current++; streakCursor = addDays(streakCursor, -1); }
    return { rate: elapsed ? Math.round(daysHit / elapsed * 100) : 0, daysHit: daysHit, currentStreak: current, bestStreak: best, elapsedDays: elapsed, taskRate: totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0 };
  }

  function coachFallback(goal, message, taskChecks) {
    var lower = String(message || '').toLowerCase();
    if (!goal) return { message: 'Create a goal first and I’ll turn its deadline, time budget, and preferred path into a practical next step.', actions: [{ label: 'Create a goal', action: 'create_goal' }] };
    var stats = getStats(goal, taskChecks || {}), tasks = getDailyTasks(goal, todayISO()), first = tasks[0];
    if (/pain|injur|medical|diagnos/.test(lower)) return { message: 'I can help adapt the workload, but I cannot assess pain or diagnose an injury. Pause movements that cause pain and get guidance from a qualified clinician or coach. We can switch today to a gentle recovery check without treating it as a failure.', actions: [{ label: 'Open today', action: 'open_today' }] };
    if (/behind|miss|stuck|failed|slip|overwhelm|hard/.test(lower)) return { message: 'Do not try to repay missed days. That usually turns one disruption into a second. For the next three sessions, keep only the minimum viable version: start with “' + first.label + ',” cap the session at ' + Math.max(15, Math.round(goal.minutesPerDay * .75)) + ' minutes, and finish by writing the next starting action. Rebuild reliability before intensity.', actions: [{ label: 'Lighten my system', action: 'rebalance' }, { label: 'Open today', action: 'open_today' }] };
    if (/busy|short|quick|minimum|lighter|time/.test(lower)) return { message: 'Use a ' + Math.max(10, Math.round(goal.minutesPerDay * .5)) + '-minute floor today. Complete “' + first.label + '” first, then spend the remaining time on the main task. Stop when the floor is met; preserving the restart is more valuable than an exhausted catch-up session.', actions: [{ label: 'Start the first task', action: 'open_today' }, { label: 'Rebalance future days', action: 'rebalance' }] };
    if (/progress|doing|trend|review/.test(lower)) return { message: 'You have completed ' + stats.daysHit + ' full days with a ' + stats.taskRate + '% task completion rate. Your current streak is ' + stats.currentStreak + ' day' + (stats.currentStreak === 1 ? '' : 's') + '. The useful question is not whether the streak looks impressive; it is whether the current session size is repeatable. Keep it if yes. Reduce it if starting has become consistently difficult.', actions: [{ label: 'View progress', action: 'open_goal' }] };
    if (/next|today|start|do/.test(lower)) return { message: 'Start with “' + first.label + '” for ' + first.minutes + ' minutes. Your only job is to begin that step; the rest of the session can earn your attention afterward. Today belongs to the ' + phaseFor(goal, todayISO()).name + ' phase, so prioritize clean repetitions and feedback over novelty.', actions: [{ label: 'Open today’s plan', action: 'open_today' }] };
    return { message: 'For “' + goal.title + ',” the highest-leverage move is to protect the next repeatable session. Today, begin with “' + first.label + '.” If your circumstances have changed, tell me what changed—available time, energy, equipment, or deadline—and I’ll adapt the system around the real constraint.', actions: [{ label: 'Show today’s plan', action: 'open_today' }, { label: 'Review roadmap', action: 'open_goal' }] };
  }

  function rebalanceGoal(goal) {
    var updated = Object.assign({}, goal, { minutesPerDay: Math.max(15, Math.round((Number(goal.minutesPerDay) || 30) * .75 / 5) * 5), adaptations: (goal.adaptations || 0) + 1 });
    updated.plan = createPlan(updated);
    return updated;
  }

  function createGoal(input) {
    var goal = Object.assign({ id: uid(), createdAt: Date.now(), priority: 'High', level: 'Beginner', daysPerWeek: 4, minutesPerDay: 30, adaptations: 0 }, input);
    goal.plan = createPlan(goal);
    return goal;
  }

  function createDemoState() {
    var today = todayISO(), fitnessStart = addDays(today, -24), learnStart = addDays(today, -9);
    var goals = [
      createGoal({ id: 'demo_strength', title: 'Build a strong, athletic body', why: 'I want energy, confidence, and strength that carries into the rest of life.', category: 'Fitness', method: 'hybrid', level: 'Beginner', daysPerWeek: 4, minutesPerDay: 45, startDate: fitnessStart, deadline: addDays(today, 60) }),
      createGoal({ id: 'demo_spanish', title: 'Hold a confident conversation in Spanish', why: 'I want to connect without translating every sentence in my head.', category: 'Learning', method: 'project', level: 'Beginner', daysPerWeek: 5, minutesPerDay: 30, startDate: learnStart, deadline: addDays(today, 82) })
    ];
    var checks = {};
    goals.forEach(function (goal, goalIndex) {
      var cursor = goal.startDate, day = 0;
      while (cursor < today) {
        var tasks = getDailyTasks(goal, cursor);
        var shouldComplete = (day + goalIndex) % 6 !== 2 && (day + goalIndex) % 11 !== 5;
        tasks.forEach(function (item, index) { if (shouldComplete || index < Math.max(1, tasks.length - 2)) checks[taskKey(goal.id, cursor, item.id)] = true; });
        cursor = addDays(cursor, 1); day++;
      }
    });
    getDailyTasks(goals[0], today).slice(0, 1).forEach(function (item) { checks[taskKey(goals[0].id, today, item.id)] = true; });
    return { version: 4, goals: goals, taskChecks: checks, chats: {}, selectedGoalId: goals[0].id, demo: true };
  }

  return {
    CATEGORIES: CATEGORIES,
    todayISO: todayISO,
    parseISO: parseISO,
    toISO: toISO,
    addDays: addDays,
    diffDays: diffDays,
    formatShort: formatShort,
    configFor: configFor,
    methodFor: methodFor,
    createPlan: createPlan,
    createGoal: createGoal,
    phaseFor: phaseFor,
    getDailyTasks: getDailyTasks,
    taskKey: taskKey,
    dayProgress: dayProgress,
    getStats: getStats,
    coachFallback: coachFallback,
    rebalanceGoal: rebalanceGoal,
    createDemoState: createDemoState
  };
});
