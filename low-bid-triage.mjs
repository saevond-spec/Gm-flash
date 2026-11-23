// Sprite-only REVIEW triage. Never transmits bids or makes readiness attestations.
// All fields are scalar metadata; discard untrusted customer text upstream.
const ID = /^[1-9]\d{0,9}$/;
const PROFILES = new Set(['csv_cleanup', 'arithmetic_reconciliation']);
const safeInt = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;

export function evaluateLowBidCandidate(task, nowMs) {
  const reasons = [];
  if (!task || typeof task !== 'object' || typeof task.problem_id !== 'string' || !ID.test(task.problem_id)) {
    return { problem_id: null, state: 'reject', reasons: ['identity_missing'], requires_council_review: true };
  }
  if (!safeInt(nowMs, 1, Number.MAX_SAFE_INTEGER)) reasons.push('clock_invalid');
  if (!['open', 'bidding'].includes(task.status)) reasons.push('not_open');
  if (task.currency !== 'USD') reasons.push('currency_unverified');
  if (task.simulated !== false) reasons.push('simulation_unverified');
  if (!safeInt(task.verified_budget_cents, 500, 2_000)) reasons.push('budget_unverified_or_out_of_range');
  if (!safeInt(task.proposed_quote_cents, 500, 2_000) || task.proposed_quote_cents > task.verified_budget_cents) reasons.push('quote_unverified_or_over_budget');
  if (task.verified_from !== 'authenticated_detail') reasons.push('detail_source_unverified');
  if (task.floor_verified_from !== 'authenticated_queue' || !safeInt(task.verified_floor_cents, 0, task.verified_budget_cents)
      || task.proposed_quote_cents < task.verified_floor_cents) reasons.push('floor_unverified_or_quote_below_floor');
  if (!safeInt(task.details_checked_at_ms, nowMs - 900_000, nowMs)) reasons.push('stale_listing');
  if (!PROFILES.has(task.profile)) reasons.push('unsupported_profile');
  if (task.scope_reviewed !== true || task.acceptance_criteria_verified !== true) reasons.push('scope_not_verified');
  if (task.isolated_delivery_verified !== true || task.fictional_rehearsal_passed !== true) reasons.push('delivery_not_verified');
  if (!safeInt(task.estimated_minutes, 15, 240) || task.incremental_cost_cents !== 0) reasons.push('cost_or_hours');
  if (task.prior_bid_checked !== true || task.has_existing_bid !== false || task.has_reservation !== false) reasons.push('prior_bid_unknown');
  if (!['held','none','unfunded'].includes(task.escrow_status)) reasons.push('escrow_status_not_verified');
  if (task.platform_limit_verified !== true || !safeInt(task.platform_limit_cents, 500, 100_000_000) || task.proposed_quote_cents > task.platform_limit_cents) reasons.push('platform_limit_unknown');
  const ready = reasons.length === 0;
  const netCents = ready ? task.proposed_quote_cents - Math.ceil(task.proposed_quote_cents * 25 / 100) : null;
  const score = ready ? Math.floor(netCents * 60_000 / task.estimated_minutes) / 1000 : null;
  return {
    problem_id: task.problem_id,
    state: ready ? 'review_candidate_only' : 'reject',
    reasons,
    proposed_quote_cents: ready ? task.proposed_quote_cents : null,
    net_if_settled_cents: netCents,
    net_per_hour_cents: score,
    escrow_risk: task.escrow_status === 'held' ? 'held' : 'unescrowed',
    payment_protection: task.escrow_status === 'held' ? 'posting_hold_reported_not_payout_guarantee' : 'unfunded_or_unprotected',
    delivery_requires_funding_verification: true,
    requires_council_review: true,
    permits_submission: false,
  };
}

export function rankLowBidReview(queue, nowMs, limit = 10) {
  if (!Array.isArray(queue) || !safeInt(limit, 1, 25)) throw new TypeError('invalid review queue');
  const seen = new Map();
  const conflictingIds = new Set();
  const reviews = [];
  for (const task of queue.slice(0, 250)) {
    const result = evaluateLowBidCandidate(task, nowMs);
    if (result.problem_id === null) continue;
    // Repeated pages can contain the same task. Conflicting verified scalars invalidate review.
    const fingerprint = JSON.stringify([task.status,task.currency,task.simulated,task.verified_budget_cents,
      task.proposed_quote_cents,task.verified_from,task.verified_floor_cents,task.floor_verified_from,task.details_checked_at_ms,task.profile,
      task.scope_reviewed,task.acceptance_criteria_verified,task.isolated_delivery_verified,
      task.fictional_rehearsal_passed,task.estimated_minutes,task.incremental_cost_cents,
      task.prior_bid_checked,task.has_existing_bid,task.has_reservation,task.escrow_status,
      task.platform_limit_verified,task.platform_limit_cents]);
    if (seen.has(result.problem_id)) {
      if (seen.get(result.problem_id) !== fingerprint) conflictingIds.add(result.problem_id);
      continue;
    }
    seen.set(result.problem_id,fingerprint);
    reviews.push(result);
  }
  const candidates = reviews.filter(x => x.state === 'review_candidate_only' && !conflictingIds.has(x.problem_id))
    .sort((a, b) => Number(a.escrow_risk !== 'held') - Number(b.escrow_risk !== 'held')
      || b.net_per_hour_cents - a.net_per_hour_cents || a.problem_id.localeCompare(b.problem_id))
    .slice(0, limit);
  return { candidates, reviewed_unique: reviews.length, rejected: reviews.filter(x => x.state === 'reject' || conflictingIds.has(x.problem_id)).length, conflicting_repeat_ids: [...conflictingIds].slice(0,25),
    submissions: 0, requires_independent_council_and_atomic_reservation: true, complete_market_scan: false };
}
