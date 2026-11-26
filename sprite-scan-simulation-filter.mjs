/**
 * Sprite #1878 — simulation-safe scanner output builder.
 *
 * A pure data-transformation layer for the existing Worker v179's scan()
 * before writing scan_status. It does NOT fetch data, send bids, mutate
 * D1, call another agent, or read customer files.
 *
 * Cached inventory escrow_status='funded' is not proof of actual escrow.
 * Report only independently verified funded details as paid candidates.
 */
const validId = v => {
  const id = typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : v;
  return typeof id === 'string' && /^[1-9]\d{0,9}$/.test(id) ? id : null;
};
const getId = x => validId(x?.problem_id ?? x?.id ?? x);
const knownTrue = x => x === true || x === 1;
const knownFalse = x => x === false || x === 0;
const isKnownSimulated = x => knownTrue(x?.simulated) ||
  knownTrue(x?.is_simulated) || knownTrue(x?.is_simulation) ||
  String(x?.bounty_type ?? '').toLowerCase() === 'simulated' ||
  x?.verification_state === 'public_page_simulated_nonpaying';
const isPositive = x => Number.isSafeInteger(x) && x > 0;
const actualFunding = t => Boolean(t?.authenticated === true &&
  t?.identity_match === true && t?.fresh_detail === true &&
  knownFalse(t?.simulated) &&
  ['held','funded'].includes(t?.escrow_status) &&
  t?.escrow_funded === true &&
  isPositive(t?.escrow_amount) &&
  isPositive(t?.budget_cents) &&
  t.escrow_amount === t.budget_cents &&
  t?.payment_evidence === 'authenticated_current_hold');

export function filterSpriteScanCandidateIds({
  ids = [], inventoryRows = [], publicFundingEvidence = [],
  authenticatedDetails = [], reservationIds = [], receiptIds = [],
  ownBidPresenceIds = []
} = {}) {
  if (!Array.isArray(ids) || !Array.isArray(inventoryRows) ||
      !Array.isArray(publicFundingEvidence) || !Array.isArray(authenticatedDetails) ||
      !Array.isArray(reservationIds) || !Array.isArray(receiptIds) ||
      !Array.isArray(ownBidPresenceIds))
    throw new TypeError('arrays required');
  if (ids.length > 10000 || inventoryRows.length > 50000 ||
      publicFundingEvidence.length > 50000 || authenticatedDetails.length > 50000 ||
      reservationIds.length > 50000 || receiptIds.length > 50000 || ownBidPresenceIds.length > 50000)
    throw new RangeError('oversized scan evidence');
  const inventory = new Map(), details = new Map();
  // Monotone safety: any explicit positive simulation evidence wins over
  // duplicate later snapshots with missing/false flags, regardless of order.
  const stickySimulated = new Set();
  for (const x of inventoryRows) {
    const id = getId(x); if(!id) continue;
    inventory.set(id,x);
    if(isKnownSimulated(x)) stickySimulated.add(id);
  }
  for (const x of authenticatedDetails) {
    const id = getId(x); if(!id) continue;
    details.set(id,x);
    if(isKnownSimulated(x)) stickySimulated.add(id);
  }
  const simulatedEvidence = new Set(publicFundingEvidence
    .filter(e => knownTrue(e?.observed_simulated) &&
      e?.evidence === 'public_page_explicit_no_real_funds')
    .map(getId).filter(Boolean));
  for(const id of simulatedEvidence) stickySimulated.add(id);
  const priorBids=new Set([...reservationIds,...receiptIds,...ownBidPresenceIds]
    .map(getId).filter(Boolean));
  const seen = new Set(), candidates = [];
  const counts = {invalid:0,duplicate:0,excluded_known_simulated:0,
    excluded_prior_bid_or_reservation:0,needs_authenticity_verification:0,
    verified_funded:0,no_escrow_risk_not_confirmed_paid:0};
  for (const record of ids) {
    const id = getId(record);
    if (!id) { counts.invalid++; continue; }
    if (seen.has(id)) { counts.duplicate++; continue; }
    seen.add(id);
    const inv = inventory.get(id),detail=details.get(id);
    if (stickySimulated.has(id) || isKnownSimulated(record) || isKnownSimulated(inv) || isKnownSimulated(detail)) {
      counts.excluded_known_simulated++; continue;
    }
    if(priorBids.has(id)) { counts.excluded_prior_bid_or_reservation++; continue; }
    const verified = actualFunding(detail);
    const funding_evidence_state=verified?'authenticated_current_hold':
      ['none','unfunded'].includes(detail?.escrow_status)?'no_escrow_not_guaranteed':
      'requires_authenticated_current_funding_verification';
    if (verified) counts.verified_funded++;
    else if (funding_evidence_state==='no_escrow_not_guaranteed')
      counts.no_escrow_risk_not_confirmed_paid++;
    else counts.needs_authenticity_verification++;
    // Preserve scan order, but never turn an unknown listing into a paid job.
    candidates.push({problem_id:id,
      simulated_known:false,bid_authorized:false,
      funding_evidence_state,review_required:true});
  }
  return {
    candidate_ids:candidates.map(x=>x.problem_id),
    candidate_status:candidates,
    verified_paying_candidate_count:counts.verified_funded,
    review_candidate_count:candidates.length,
    diagnostics:counts,
    requires_separate_bid_authentication:true,
    detailed_scope_review_stage:'post_award'
  };
}
