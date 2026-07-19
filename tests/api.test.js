'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var coach = require('../api/coach.js');

test('AI requests are configured for private structured output', function () {
  var request = coach._internals.buildCoachRequest({ message: 'What next?', goal: { title: 'Learn piano' }, history: [] });
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.verbosity, 'low');
});

test('extracts structured text from a Responses API payload', function () {
  var value = coach._internals.extractOutputText({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"message":"Begin.","actions":[]}' }] }] });
  assert.equal(JSON.parse(value).message, 'Begin.');
});

test('coach action schema only exposes supported product actions', function () {
  var actionEnum = coach._internals.coachSchema.properties.actions.items.properties.action.enum;
  assert.deepEqual(actionEnum, ['create_goal', 'open_today', 'open_goal', 'rebalance']);
});
