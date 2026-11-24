// Sprite-only ClawHunt v1 bid contract. No fetch, credentials, customer files or side effects.
// Reference: https://clawhunt.store/openapi.json and /api/v1/bids/criteria (2026-11-24).
export const SPRITE_BID_POLICY = Object.freeze({
  agent_id: 1878, minimum_cents: 2000, maximum_cents: 10000000,
  currency: 'USD', platform_fee_bps: 2500, maximum_edits: 3
});
const cents = n => Number.isSafeInteger(n) && n > 0;
const idOf = v => String(v?.id ?? v?.problem_id ?? v?.task_id ?? '');
const str = v => typeof v === 'string' ? v.trim() : '';
const simulated = t => t?.simulated === true || t?.is_simulated === true ||
  t?.is_simulation === true || str(t?.bounty_type).toLowerCase() === 'simulated';

// Returns bounds, NOT permission to bid. Scope, account standing and independent approval are separate gates.
export function verifiedMarketBounds(task, queue = null) {
  const reasons = [], id = idOf(task);
  if (!/^[1-9][0-9]{0,9}$/.test(id)) reasons.push('task_identity');
  if (!['open', 'bidding'].includes(str(task?.status).toLowerCase())) reasons.push('task_not_biddable');
  if (str(task?.currency).toUpperCase() !== 'USD') reasons.push('currency');
  if (simulated(task)) reasons.push('simulated');
  const escrow = str(task?.escrow_status).toLowerCase();
  const funded = ['held', 'funded'].includes(escrow) &&
    task?.escrow_funded === true && task?.payment_evidence === 'funded_escrow';
  const unheld = ['none', 'unfunded'].includes(escrow) &&
    task?.escrow_funded === false && task?.payment_evidence === 'no_payment_recorded';
  let budget = null, funding_kind = 'unknown';
  if (funded) {
    if (cents(task.escrow_amount) && cents(task.price) && task.escrow_amount === task.price) {
      budget = task.escrow_amount;
      funding_kind = 'posting_funded';
    } else reasons.push('funded_amount_conflict');
  } else if (unheld) {
    if (cents(task.reference_price) && (task.price === 0 || task.price === null || task.price === undefined) &&
        (task.escrow_amount === 0 || task.escrow_amount === null || task.escrow_amount === undefined)) {
      budget = task.reference_price;
      funding_kind = 'reference_only_no_escrow';
    } else reasons.push('reference_price_conflict');
  } else reasons.push('funding_state_not_verified');
  // The current public contract exposes cents and corresponding credits: 100 cents per credit.
  if (cents(task?.price) && task.price_credits != null &&
      (!Number.isSafeInteger(task.price_credits) || task.price !== task.price_credits * 100)) reasons.push('price_units_conflict');
  if (cents(task?.reference_price) && task.reference_price_credits != null &&
      (!Number.isSafeInteger(task.reference_price_credits) || task.reference_price !== task.reference_price_credits * 100)) reasons.push('reference_units_conflict');
  if (!cents(budget)) reasons.push('no_verified_budget');
  if (queue != null) {
    const qid = idOf(queue);
    if (qid !== id) reasons.push('queue_task_mismatch');
    if (queue.own_bid != null && queue.own_bid !== false) reasons.push('existing_bid_requires_reconciliation');
    if (queue.my_bid != null && queue.my_bid !== false) reasons.push('existing_bid_requires_reconciliation');
  }
  const officialMinimum = budget ? Math.min(budget, Math.max(100, Math.ceil(budget * 0.05))) : null;
  const queueFloor = queue?.price_floor_cents;
  if (queueFloor != null && (!cents(queueFloor) || !budget || queueFloor > budget)) reasons.push('invalid_queue_floor');
  const floor = budget ? Math.max(officialMinimum, cents(queueFloor) ? queueFloor : officialMinimum) : null;
  return {
    ok: reasons.length === 0, problem_id: id, currency: 'USD', funding_kind,
    budget_cents: budget, price_floor_cents: floor, reasons: [...new Set(reasons)],
    contract_version: 'clawhunt-bid-criteria-v1'
  };
}

const LIMITS = Object.freeze({
  deliverables: 1500, format: 300, exclusions: 1000, materials: 1000,
  timeline: 300, evidence: 1000
});
export function buildClawHuntBidRequest(intent, bounds) {
  if (!intent || !bounds?.ok || String(intent.problem_id) !== bounds.problem_id ||
      intent.agent_id !== SPRITE_BID_POLICY.agent_id) throw Error('unverified_bid_identity_or_bounds');
  const amount = intent.amount_cents;
  if (!cents(amount) || amount < SPRITE_BID_POLICY.minimum_cents ||
      amount > SPRITE_BID_POLICY.maximum_cents || amount < bounds.price_floor_cents ||
      amount > bounds.budget_cents) throw Error('bid_outside_verified_bounds');
  const message = str(intent.buyer_message), proposal = str(intent.proposal_text);
  if (message.length < 10 || message.length > 1000 ||
      proposal.length < 120 || proposal.length > 5000 || message.length + proposal.length < 120) throw Error('invalid_bid_copy');
  if (/(?:placeholder|lorem ipsum|占位)/i.test(message + '\n' + proposal)) throw Error('placeholder_copy');
  const estimated_time = str(intent.estimated_time);
  if (!estimated_time || estimated_time.length > 100) throw Error('missing_delivery_estimate');
  const scope = intent.scope_details;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) ||
      Object.keys(scope).some(k => !(k in LIMITS) && k !== 'revisions')) throw Error('invalid_scope');
  const details = {};
  for (const [key, maximum] of Object.entries(LIMITS)) {
    const value = str(scope[key]);
    if (value.length > maximum) throw Error('scope_too_long_' + key);
    if (value) details[key] = value;
  }
  if (!details.deliverables || !details.evidence || !details.timeline) throw Error('incomplete_scope');
  if (!Number.isSafeInteger(scope.revisions) || scope.revisions < 0 ||
      scope.revisions > SPRITE_BID_POLICY.maximum_edits) throw Error('invalid_revisions');
  details.revisions = scope.revisions;
  return {amount, message, proposal_text: proposal, estimated_time, scope_details: details};
}

export function bidGrossNetCents(amount, feeBps = SPRITE_BID_POLICY.platform_fee_bps) {
  if (!cents(amount) || !Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > 10000) throw Error('invalid_fee');
  return {gross_cents: amount, estimated_net_after_fee_cents: Math.floor(amount * (10000 - feeBps) / 10000), fee_assumption_bps: feeBps};
}
