import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPublicAcceptancePlan as review} from '../sprite-acceptance-plan-review.mjs';
const c='Provide an independently checkable public-data report with a reproducible acceptance test';
const base=()=>({
  agent_id:1878,task_status:'bidding',amount_cents:6500,budget_cents:9000,price_floor_cents:2000,
  estimated_hours:24,additional_spend_cents:0,delivery_capability_verified:true,
  identity_approved:true,task_identity_verified:true,duplicate_status_clear:true,
  public_criteria:[c],
  acceptance_checks:[{criterion_index:1,plan:'Create the specified independent report with documented public-source methods.',
    verification_steps:'Run a deterministic review and compare the output to the stated public checklist.',
    deliverable_format:'Markdown report',capability_confirmed:true}]
});
test('complete structure needs separate semantic review',()=>{
  const r=review(base());assert.equal(r.passed_structural_review,true);
  assert.equal(r.structural_coverage_percent,100);
  assert.equal(r.permits_marketplace_submission,false);
  assert.equal(r.requires_independent_semantic_review,true);
});
test('no input fails closed',()=>assert.equal(review(null).permits_marketplace_submission,false));
test('missing criteria fail closed',()=>{
  const x=base();x.public_criteria=[];
  const r=review(x);assert.equal(r.passed_structural_review,false);
  assert.ok(r.reasons.includes('invalid_public_acceptance_criteria'));
});
test('missing check fails closed',()=>{
  const x=base();x.acceptance_checks=[];
  const r=review(x);assert.ok(r.reasons.includes('acceptance_criteria_not_fully_mapped'));
});
test('duplicate criterion cannot masquerade as evidence',()=>{
  const x=base();x.acceptance_checks.push({...x.acceptance_checks[0]});
  assert.equal(review(x).structured_criteria_covered,0);
});
test('partial coverage reports internal structural percentage only',()=>{
  const x=base();x.public_criteria=[c,c];const r=review(x);
  assert.equal(r.structural_coverage_percent,50);
  assert.equal(r.score_kind,'internal_structural_coverage_not_official');
});
test('scope text never returned',()=>{
  const x=base();x.public_criteria=['PUBLIC-BRIEF-PROTECTED-STRING'];const r=review(x);
  assert.ok(!JSON.stringify(r).includes('PUBLIC-BRIEF-PROTECTED-STRING'));
});
test('reject identity mismatch',()=>{
  const x=base();x.agent_id=1744;assert.ok(review(x).reasons.includes('sprite_agent_identity_required'));
});
test('unknown task status blocked',()=>{
  const x=base();x.task_status='closed';assert.ok(review(x).reasons.includes('task_not_open'));
});
test('no extra spend',()=>{
  const x=base();x.additional_spend_cents=1;assert.ok(review(x).reasons.includes('additional_spending_not_permitted'));
});
test('price under verified floor rejected',()=>{
  const x=base();x.amount_cents=1999;assert.equal(review(x).passed_structural_review,false);
});
test('price above verified ceiling rejected',()=>{
  const x=base();x.amount_cents=9500;assert.ok(review(x).reasons.includes('marketplace_quote_bounds_unverified'));
});
test('unknown delivery capability rejected',()=>{
  const x=base();x.delivery_capability_verified=false;assert.ok(review(x).reasons.includes('delivery_capability_not_independently_verified'));
});
test('uncertain duplicate reservation blocks readiness',()=>{
  const x=base();x.duplicate_status_clear=false;assert.ok(review(x).reasons.includes('existing_or_uncertain_bid_must_be_reconciled'));
});
test('estimated hours must be viable',()=>{
  const x=base();x.estimated_hours=0;assert.ok(review(x).reasons.includes('invalid_delivery_schedule'));
});
test('each criterion must have actual evidence steps',()=>{
  const x=base();x.acceptance_checks[0].verification_steps='done';assert.equal(review(x).structured_criteria_covered,0);
});
test('reject response field count explosion',()=>{
  const x=base();x.public_criteria=Array(100).fill(c);assert.equal(review(x).passed_structural_review,false);
});
test('proof means more than headings',()=>{
  const x=base();x.acceptance_checks[0].plan='Intro Scope Details';assert.equal(review(x).structured_criteria_covered,0);
});
test('unknown budget cannot be used for binding quote',()=>{
  const x=base();x.budget_cents=null;assert.ok(review(x).reasons.includes('marketplace_quote_bounds_unverified'));
});
