import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLowBidCandidate, rankLowBidReview } from '../low-bid-triage.mjs';
const now=1800000000000;
const valid=(o={})=>({problem_id:'9951', status:'open',currency:'USD',simulated:false,
 verified_budget_cents:1000, proposed_quote_cents:750, verified_from:'authenticated_detail',
 details_checked_at_ms:now-1000,profile:'csv_cleanup',scope_reviewed:true,acceptance_criteria_verified:true,
 isolated_delivery_verified:true,fictional_rehearsal_passed:true,estimated_minutes:60,incremental_cost_cents:0,
 prior_bid_checked:true,has_existing_bid:false,has_reservation:false,escrow_status:'held',
 platform_limit_verified:true,platform_limit_cents:2000,...o});
test('safe small candidate is *review only*, never submission',()=>{
 const r=evaluateLowBidCandidate(valid(),now);
 assert.equal(r.state,'review_candidate_only');assert.equal(r.permits_submission,false);
 assert.equal(r.proposed_quote_cents,750);assert.equal(r.net_if_settled_cents,562);
});
for(const [name,attrs,reason] of [
 ['missing price',{verified_budget_cents:null},'budget_unverified_or_out_of_range'],
 ['unknown units',{verified_from:'public_search'},'detail_source_unverified'],
 ['old quote',{details_checked_at_ms:now-900001},'stale_listing'],
 ['under $5',{proposed_quote_cents:499},'quote_unverified_or_over_budget'],
 ['more than $20',{verified_budget_cents:2100,proposed_quote_cents:2001},'budget_unverified_or_out_of_range'],
 ['over budget',{proposed_quote_cents:1001},'quote_unverified_or_over_budget'],
 ['unreviewed scope',{scope_reviewed:false},'scope_not_verified'],
 ['unsupported profile',{profile:'web_rewrite'},'unsupported_profile'],
 ['no isolated delivery',{isolated_delivery_verified:false},'delivery_not_verified'],
 ['nonzero spend',{incremental_cost_cents:1},'cost_or_hours'],
 ['duplicate',{has_existing_bid:true},'prior_bid_unknown'],
 ['unresolved reservation',{has_reservation:true},'prior_bid_unknown'],
 ['simulated',{simulated:true},'simulation_unverified'],
 ['wrong currency',{currency:'EUR'},'currency_unverified'],
 ['unescrowed not opted in',{escrow_status:'none'},'escrow_status_not_verified'],
 ['missing platform limit',{platform_limit_verified:false},'platform_limit_unknown'],
]) test('reject '+name,()=>{const r=evaluateLowBidCandidate(valid(attrs),now);assert.equal(r.state,'reject');assert.ok(r.reasons.includes(reason));});
test('unescrowed optional for review but visibly risky',()=>{
 const r=evaluateLowBidCandidate(valid({escrow_status:'none',allow_unescrowed_review:true}),now);
 assert.equal(r.state,'review_candidate_only');assert.equal(r.escrow_risk,'unescrowed');
});
test('sort prefers held escrow then verified net per hour, not fictional win chance',()=>{
 const q=[valid({problem_id:'9951',proposed_quote_cents:750,estimated_minutes:60}),
 valid({problem_id:'9952',proposed_quote_cents:1400,verified_budget_cents:1400,estimated_minutes:240}),
 valid({problem_id:'9953',proposed_quote_cents:2000,verified_budget_cents:2000,estimated_minutes:30,escrow_status:'none',allow_unescrowed_review:true})];
 const r=rankLowBidReview(q,now);assert.deepEqual(r.candidates.map(x=>x.problem_id),['9951','9952','9953']);assert.equal(r.submissions,0);
});
test('deduplicates review queue; no customer text copied into output',()=>{
 const r=rankLowBidReview([valid({description:'PRIVATE_CANARY'}),valid(),valid({problem_id:'9952',proposed_quote_cents:0})],now);
 assert.equal(r.reviewed_unique,2);assert.equal(r.candidates.length,1);assert.ok(!JSON.stringify(r).includes('PRIVATE_CANARY'));
});
test('conflicting duplicate task prices are held, not selected',()=>{
 const r=rankLowBidReview([valid(), valid({verified_budget_cents:1200})],now);
 assert.equal(r.candidates.length,0);assert.deepEqual(r.conflicting_repeat_ids,['9951']);
});
