// Sprite-only authenticated ClawHunt bid receipt normalizer.
// A receipt must identify exactly one agent, bid ID and amount. Never infer success from HTTP 200 alone.
export function exactBidReceipt(payload, problemId, amountCents, {allowList=false, submissionContext=false}={}) {
  if (!payload || typeof payload !== 'object' || payload.success === false ||
      payload.ok === false || payload.error) return null;
  const wanted = String(problemId);
  if (!/^[1-9][0-9]{0,9}$/.test(wanted) || !Number.isSafeInteger(amountCents) || amountCents < 1) return null;
  const roots = [payload,payload.data,payload.problem,payload.data?.problem]
    .filter(x => x && typeof x === 'object' && !Array.isArray(x));
  if (roots.some(x => x.success === false || x.ok === false || x.error)) return null;
  const candidates = [];
  for (const d of roots) {
    // The documented ProblemBidResponse can be returned directly or under data/bid.
    candidates.push(d.bid,d.proposal);
    if (d.id != null && (d.estimated_cost != null || d.amount_cents != null)) candidates.push(d);
    if (allowList) for (const a of [d.bids,d.proposals]) {
      if (Array.isArray(a)) {
        if (a.length > 200) return null;
        candidates.push(...a);
      }
    }
  }
  const matches = new Map();
  for (const bid of candidates) {
    if (!bid || typeof bid !== 'object' || Array.isArray(bid)) continue;
    const bidId = String(bid.bid_id ?? bid.proposal_id ?? bid.id ?? '');
    const agent = String(bid.agent_id ?? bid.agent?.id ?? bid.agent?.agent_id ?? '');
    const amount = bid.amount_cents ?? bid.estimated_cost ?? bid.price_cents;
    const task = bid.problem_id ?? bid.task_id ?? bid.problem?.id;
    const status = String(bid.status ?? '').toLowerCase();
    if (!/^[1-9][0-9]{0,12}$/.test(bidId) || agent !== '1878' || amount !== amountCents ||
        (task != null ? String(task) !== wanted : !submissionContext)) continue;
    // A submitted bid can later lose or be withdrawn; retain that status separately from existence.
    if (!['pending','submitted','active','accepted','selected','rejected','withdrawn','lost','won','placed'].includes(status)) continue;
    const previous = matches.get(bidId);
    if (previous && previous.status !== status) return null; // conflicting envelopes
    matches.set(bidId,{bid_id:bidId,problem_id:wanted,agent_id:1878,amount_cents:amount,status,
      task_id_source:task == null ? 'authenticated_submission_target' : 'receipt'});
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
}
