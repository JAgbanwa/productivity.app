'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var planner = require('../planner.js');

function learningGoal(overrides) {
  return planner.createGoal(Object.assign({
    id: 'test_goal', title: 'Learn piano', category: 'Learning', method: 'structured', level: 'Beginner',
    daysPerWeek: 5, minutesPerDay: 30, startDate: '2026-07-20', deadline: '2026-10-19', why: 'Play confidently.'
  }, overrides || {}));
}

test('creates a bounded three-phase roadmap from a deadline', function () {
  var goal = learningGoal();
  assert.equal(goal.plan.phases.length, 3);
  assert.equal(goal.plan.phases[0].startDay, 1);
  assert.equal(goal.plan.phases[2].endDay, planner.diffDays(goal.startDate, goal.deadline) + 1);
  assert.match(goal.plan.summary, /30 minutes/);
});

test('generates domain-specific active and recovery tasks', function () {
  var goal = learningGoal();
  var monday = planner.getDailyTasks(goal, '2026-07-20');
  var sunday = planner.getDailyTasks(goal, '2026-07-26');
  assert.equal(monday.length, 4);
  assert.match(monday[0].label, /Recall/);
  assert.equal(sunday.length, 2);
  assert.match(sunday[0].label, /Recall/);
});

test('tracks partial days, complete days, and streaks from task evidence', function () {
  var goal = learningGoal({ startDate: '2026-07-20', deadline: '2026-07-27' });
  var checks = {};
  ['2026-07-20', '2026-07-21'].forEach(function (date) {
    planner.getDailyTasks(goal, date).forEach(function (item) { checks[planner.taskKey(goal.id, date, item.id)] = true; });
  });
  var partialTask = planner.getDailyTasks(goal, '2026-07-22')[0];
  checks[planner.taskKey(goal.id, '2026-07-22', partialTask.id)] = true;
  assert.equal(planner.dayProgress(goal, '2026-07-20', checks), 1);
  assert.ok(planner.dayProgress(goal, '2026-07-22', checks) > 0);
  var stats = planner.getStats(goal, checks, '2026-07-22');
  assert.equal(stats.daysHit, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.currentStreak, 2);
});

test('rebalancing lowers session load without changing the deadline', function () {
  var goal = learningGoal({ minutesPerDay: 60 });
  var updated = planner.rebalanceGoal(goal);
  assert.equal(updated.minutesPerDay, 45);
  assert.equal(updated.deadline, goal.deadline);
  assert.equal(updated.adaptations, 1);
});

test('offline coach gives a safe, actionable restart', function () {
  var goal = learningGoal();
  var reply = planner.coachFallback(goal, 'I missed a few days and feel stuck', {});
  assert.match(reply.message, /Do not try to repay missed days/);
  assert.ok(reply.actions.some(function (item) { return item.action === 'rebalance'; }));
});

test('fitness planning includes general safety language for pain', function () {
  var goal = planner.createGoal({ id: 'fit', title: 'Get stronger', category: 'Fitness', method: 'hybrid', level: 'Beginner', daysPerWeek: 4, minutesPerDay: 45, startDate: '2026-07-20', deadline: '2026-10-20' });
  var reply = planner.coachFallback(goal, 'My shoulder pain is getting worse', {});
  assert.match(reply.message, /qualified clinician or coach/);
  assert.doesNotMatch(reply.message, /diagnosis/i);
});
