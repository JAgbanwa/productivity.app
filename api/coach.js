'use strict';

var OPENAI_URL = 'https://api.openai.com/v1/responses';
var MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';

var ACTIONS = ['create_goal', 'open_today', 'open_goal', 'rebalance'];
var planSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string', maxLength: 280 },
    successMetric: { type: 'string', maxLength: 180 },
    coachNote: { type: 'string', maxLength: 180 },
    phases: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        properties: { name: { type: 'string', maxLength: 40 }, outcome: { type: 'string', maxLength: 180 } },
        required: ['name', 'outcome']
      }
    }
  },
  required: ['summary', 'successMetric', 'coachNote', 'phases']
};
var coachSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    message: { type: 'string', maxLength: 900 },
    actions: {
      type: 'array', maxItems: 2,
      items: {
        type: 'object', additionalProperties: false,
        properties: { label: { type: 'string', maxLength: 36 }, action: { type: 'string', enum: ACTIONS } },
        required: ['label', 'action']
      }
    }
  },
  required: ['message', 'actions']
};

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI coaching is not configured. The app will use its offline coach.' });

  var body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  if (!body || !['chat', 'plan'].includes(body.action)) return res.status(400).json({ error: 'Invalid action.' });
  if (body.action === 'chat' && (!body.message || String(body.message).length > 800)) return res.status(400).json({ error: 'Message must be between 1 and 800 characters.' });

  try {
    var request = body.action === 'plan' ? buildPlanRequest(body) : buildCoachRequest(body);
    var output = await callOpenAI(request);
    if (body.action === 'plan') return res.status(200).json({ plan: output, model: MODEL });
    return res.status(200).json({ message: output.message, actions: output.actions, model: MODEL });
  } catch (error) {
    console.error('Momentum coach request failed:', error && error.message ? error.message : error);
    return res.status(error && error.status ? error.status : 502).json({ error: 'The AI coach is temporarily unavailable. The app will use its offline coach.' });
  }
};

function buildPlanRequest(body) {
  var goal = sanitizeObject(body.goal, 2200);
  var localPlan = sanitizeObject(body.localPlan, 2600);
  return {
    model: MODEL,
    store: false,
    reasoning: { effort: 'medium' },
    max_output_tokens: 1200,
    instructions: [
      'Role: You are Momentum, a practical goal-system designer.',
      'Goal: Improve the supplied three-phase plan so the user has the shortest sustainable path to a verifiable outcome.',
      'Success means: preserve the user’s deadline, chosen method, level, available days, and minutes; make each phase concrete; define an honest success metric; avoid promising mastery or physical results by a certain date.',
      'For fitness, give general educational programming only, use controlled progression and recovery, and never diagnose, prescribe nutrition, or instruct through pain.',
      'For learning, prioritize retrieval, applied practice, feedback, and a capstone over passive content consumption.',
      'Return only the requested structured object. Keep every field concise and action-oriented.'
    ].join('\n'),
    input: 'User goal and constraints:\n' + goal + '\n\nDeterministic baseline to improve, preserving its three-phase structure:\n' + localPlan,
    text: { verbosity: 'low', format: { type: 'json_schema', name: 'momentum_plan', strict: true, schema: planSchema } }
  };
}

function buildCoachRequest(body) {
  var goal = sanitizeObject(body.goal, 4600);
  var history = sanitizeObject(Array.isArray(body.history) ? body.history.slice(-6) : [], 2600);
  return {
    model: MODEL,
    store: false,
    reasoning: { effort: 'medium' },
    max_output_tokens: 900,
    instructions: [
      'Role: You are Momentum, a calm and honest execution coach inside a goal-tracking app.',
      'Personality: Direct, warm, specific, and never shaming. Treat a missed day as planning evidence.',
      'Goal: Help the user take the most useful next action within the goal system and real constraints provided.',
      'Success means: answer the actual question; name one concrete next action; preserve the user’s chosen path unless they ask to change it; prefer a smaller restart over catch-up work; use at most two UI actions.',
      'Do not promise mastery, body changes, or guaranteed results by a date. Do not diagnose health issues. If pain, injury, disordered eating, crisis, or medical concerns appear, advise appropriate qualified support and keep app guidance general.',
      'Do not invent completed work. Treat the supplied stats and checklist as the only progress evidence.',
      'Available UI actions: open_today shows today’s checklist; open_goal shows progress and roadmap; rebalance reduces future session duration; create_goal opens goal setup.',
      'Return only the requested structured object.'
    ].join('\n'),
    input: 'Current goal context:\n' + goal + '\n\nRecent conversation:\n' + history + '\n\nUser request:\n' + String(body.message).trim(),
    text: { verbosity: 'low', format: { type: 'json_schema', name: 'momentum_coach_reply', strict: true, schema: coachSchema } }
  };
}

async function callOpenAI(payload) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 25000);
  var response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify(payload)
    });
  } finally { clearTimeout(timer); }
  var data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    var apiError = new Error((data.error && data.error.message) || 'OpenAI request failed.');
    apiError.status = response.status === 429 ? 429 : 502;
    throw apiError;
  }
  var text = extractOutputText(data);
  if (!text) throw new Error('The model returned no usable output.');
  try { return JSON.parse(text); } catch (error) { throw new Error('The model returned invalid structured output.'); }
}

function extractOutputText(response) {
  var refusal = null, text = '';
  (response.output || []).forEach(function (item) {
    (item.content || []).forEach(function (part) {
      if (part.type === 'refusal') refusal = part.refusal;
      if (part.type === 'output_text') text += part.text || '';
    });
  });
  if (refusal) { var error = new Error(refusal); error.status = 400; throw error; }
  return text;
}

function sanitizeObject(value, maxLength) {
  var text;
  try { text = JSON.stringify(value == null ? null : value); } catch (error) { text = 'null'; }
  return text.slice(0, maxLength);
}
function safeParse(value) { try { return JSON.parse(value); } catch (error) { return null; } }
function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

module.exports._internals = { buildPlanRequest: buildPlanRequest, buildCoachRequest: buildCoachRequest, extractOutputText: extractOutputText, planSchema: planSchema, coachSchema: coachSchema };
