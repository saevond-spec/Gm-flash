// Sprite-only ClawHunt contract adapter. No network writes or customer data.
export const BID_CONTRACT_VERSION = 'sprite.clawhunt.bid.v3';
export const BID_MIN_CENTS = 2000;
export const BID_MAX_CENTS = 10000000;
const isCents = x => Number.isSafeInteger(x) && x > 0 && x <= 2147483647;
const idString = value => /^[1-9][0-9]{0,9}$/.test(String(value ?? '')) ? String(value) : null;
const sameTask = (a,b) => idString(a) !== null && idString(a) === idString(b);
const err = (code) => Object.assign(new Error(code), {code});
const status = x => String(x ?? '').trim().toLowerCase();

export function normalizeTaskPrice(task, queueRow, {allowUnfunded = true} = {}) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) throw err('invalid_task');
  if (!['open','bidding'].includes(status(task.status))) throw err('task_not_open');
  if (status(task.currency) !== 'usd') throw err('currency_unverified');
  if (task.simulated === true || task.is_simulated === true || status(task.bounty_type) === 'simulated') throw err('simulated_task');
  if (queueRow && !sameTask(queueRow.problem_id ?? queueRow.task_id ?? queueRow.id,task.problem_id ?? task.id)) throw err('task_id_mismatch');
  const funded = task.escrow_funded === true && status(task.escrow_status) === 'funded';
  const unheld = task.escrow_funded === false && ['none','unfunded'].includes(status(task.escrow_status));
  if (!funded && !(unheld && allowUnfunded)) throw err('funding_state_unverified');
  // The public task API currently expresses price and reference_price in cents.
  // The authenticated queue determines its own floor; absence is not guessed.
  const budget = funded ? task.price : task.reference_price;
  if (!isCents(budget)) throw err('budget_unverified');
  if (funded && (!isCents(task.escrow_amount) || task.escrow_amount < budget)) throw err('escrow_inconsistent');
  const floor = queueRow?.price_floor_cents;
  if (!isCents(floor) || floor > budget) throw err('queue_floor_unverified');
  const computedFloor = Math.min(budget, Math.max(100,Math.ceil(budget * 0.05)));
  if (floor < computedFloor) throw err('queue_floor_policy_mismatch'); // Task-specific floor may exceed minimum published policy.
  return Object.freeze({problem_id:idString(task.problem_id ?? task.id),budget_cents:budget,floor_cents:floor,funding:funded?'funded':'reference_unheld',source:'authenticated_task_plus_queue',requires_live_recheck:true});
}

export function validateBidPackage(intent, bound) {
  if (!intent || typeof intent !== 'object' || !bound || typeof bound !== 'object') throw err('invalid_intent');
  if (!sameTask(intent.problem_id,bound.problem_id)) throw err('task_mismatch');
  const amount = intent.amount_cents;
  if (!isCents(amount) || amount < BID_MIN_CENTS || amount > BID_MAX_CENTS || amount < bound.floor_cents || amount > bound.budget_cents) throw err('bid_price_outside_verified_bounds');
  const message = intent.message, proposal = intent.proposal_text;
  if (typeof message !== 'string' || message.trim().length < 10 || message.length > 1000) throw err('invalid_message');
  if (typeof proposal !== 'string' || proposal.trim().length < 50 || proposal.length > 5000 || message.length + proposal.length < 120) throw err('incomplete_proposal');
  if (/placeholder|lorem ipsum|占位/i.test(message + proposal)) throw err('placeholder_proposal');
  if (typeof intent.estimated_time !== 'string' || !intent.estimated_time.trim() || intent.estimated_time.length > 100) throw err('missing_timeline');
  const scope = intent.scope_details;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw err('missing_contract_scope');
  const caps = {deliverables:1500,format:300,exclusions:1000,materials:1000,timeline:300,evidence:1000};
  const safeScope = {};
  for (const [key,max] of Object.entries(caps)) {
    const value=scope[key];
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw err('scope_' + key + '_unverified');
    safeScope[key] = value.trim();
  }
  if (!Number.isInteger(scope.revisions) || scope.revisions < 0 || scope.revisions > 3) throw err('invalid_revision_terms');
  safeScope.revisions=scope.revisions;
  if (intent.demo_video_url != null) throw err('unverified_demo_url'); // Explicit opt-in after URL validation only.
  return Object.freeze({amount,message:message.trim(),proposal_text:proposal.trim(),estimated_time:intent.estimated_time.trim(),scope_details:Object.freeze(safeScope)});
}

export function classifyBidReceipt(payload,{problem_id,agent_id,amount_cents}={}) {
  if (!payload || typeof payload !== 'object' || payload.success === false || payload.ok === false || payload.error) return {confirmed:false,reason:'upstream_error'};
  const roots=[payload,payload.data,payload.data?.bid,payload.bid,payload.proposal,payload.data?.proposal].filter(x=>x && typeof x==='object' && !Array.isArray(x));
  const ids=new Set();
  for (const x of roots) {
    if (x.success === false || x.ok === false || x.error) continue;
    const bidId=idString(x.bid_id ?? x.id ?? x.proposal_id);
    if (!bidId) continue;
    const task=x.problem_id ?? x.task_id ?? x.problem?.id ?? x.contract?.problem_id;
    const agent=x.agent_id ?? x.agent?.id ?? x.agent?.agent_id;
    const price=x.amount_cents ?? x.estimated_cost ?? x.price_cents;
    if (!sameTask(task,problem_id) || String(agent ?? '') !== String(agent_id) || price !== amount_cents) continue;
    const bidStatus=status(x.status);
    if (!['pending','submitted','active','accepted','selected','rejected','withdrawn','lost','won','placed'].includes(bidStatus)) continue;
    ids.add(bidId);
  }
  return ids.size === 1 ? {confirmed:true,bid_id:[...ids][0],problem_id:String(problem_id),amount_cents,agent_id:Number(agent_id),source:'authenticated_verified_response'} : {confirmed:false,reason:ids.size>1?'conflicting_bid_records':'receipt_bindings_missing'};
}

export function nextPageOffset({offset=0,limit=20,returned,uniqueNew}) {
  if (!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(returned)||returned<0||returned>limit||!Number.isSafeInteger(uniqueNew)||uniqueNew<0||uniqueNew>returned) throw err('invalid_pagination');
  // Stop on exhausted or repeated page. An empty page is not evidence of a complete market unless offset coverage is tracked.
  return returned<limit || uniqueNew===0 ? null : offset+limit;
}
