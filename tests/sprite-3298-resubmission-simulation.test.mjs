import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateSpriteResubmissionReview} from '../sprite-3298-resubmission-simulation.mjs';

const requirements=[
 'Provide a fictional cleaned CSV with row count',
 'Produce a fictional reconciliation log of changed rows'
];
const task=()=>({source:'authenticated_task_detail',problem_id:'99591',status:'bidding',
 currency:'USD',simulated:false,scope_verified:true,delivery_isolated:true,
 acceptance_complete:true,verified_floor_cents:500,verified_budget_cents:1000,
 incremental_cost_cents:0,requirements:[...requirements]});
const draft=()=>({
 proposal:[
 'Deliverables: Produce a fictional cleaned CSV with row count and an accompanying change log.',
 'Acceptance criteria: Produce a fictional reconciliation log of changed rows; keep the input untouched.',
 'Verification: Recompute row totals, inspect changes, and attach a synthetic reproducibility report.',
 'Exclusions: No paid tools, no external customer data and no claims of completed work.',
 'Timeline: Start only after selection; one isolated delivery and one revision.'
 ].join('\n'),
 buyerMessage:'My fixed quote covers the listed Acceptance criteria and includes verification evidence. I will begin only after selection and use an isolated fictional-data workflow.'
});
const setup=()=>({task:task(),agentId:1878,quoteCents:750,
 existingReservation:{problem_id:'99591',agent_id:1878,state:'none'},
 ...draft(),
 motherReview:async()=>({decision:'pass'}),
 novaReview:async()=>({decision:'pass'})});
test('HISTORICAL #3298: unknown $6.50 bid must not be resubmitted, even with perfect reviews',async()=>{
 const p=setup();let calls=0;
 p.task.problem_id='3298';p.existingReservation.problem_id='3298';
 p.existingReservation.state='uncertain';p.quoteCents=650;
 p.motherReview=async()=>{calls++;return {decision:'pass'}};
 p.novaReview=async()=>{calls++;return {decision:'pass'}};
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'unknown_previous_submission_do_not_retry');
 assert.equal(r.can_submit,false);assert.equal(r.submitted,false);assert.equal(calls,0);
 assert.equal(r.requires_authoritative_receipt,true);
});
test('HISTORICAL #3298: 64 concurrent fictional retry attempts all block before advisory review',async()=>{
 const p=setup();p.task.problem_id='3298';p.existingReservation.problem_id='3298';
 p.existingReservation.state='uncertain';p.quoteCents=650;let calls=0;
 p.motherReview=async()=>{calls++;return {decision:'pass'}};
 const xs=await Promise.all(Array.from({length:64},()=>simulateSpriteResubmissionReview(p)));
 assert.equal(xs.filter(x=>x.can_submit).length,0);
 assert.equal(xs.filter(x=>x.reason==='unknown_previous_submission_do_not_retry').length,64);
 assert.equal(calls,0);
});
test('fictional open task with truthful coverage passes two advisory reviewers but never authorizes a send',async()=>{
 const r=await simulateSpriteResubmissionReview(setup());
 assert.equal(r.state,'fictional_draft_passed_advisory_reviews');
 assert.equal(r.mother_reviewed_in_simulation,true);assert.equal(r.nova_reviewed_in_simulation,true);
 assert.equal(r.escrow_required,false);assert.equal(r.can_submit,false);assert.equal(r.submitted,false);
});
test('fictional job: Mother denies unsupported deliverability',async()=>{
 const p=setup();p.motherReview=async()=>({decision:'hold'});
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'mother_advisory_review_hold');assert.equal(r.can_submit,false);
});
test('fictional job: Nova denies even when Mother passes',async()=>{
 const p=setup();p.novaReview=async()=>({decision:'hold'});
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'nova_advisory_review_hold');assert.equal(r.can_submit,false);
});
test('fictional job: missing both reviewers never counts as approval',async()=>{
 const p=setup();p.novaReview=null;
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'independent_advisory_reviewers_missing');
});
test('fictional job: missing acceptance criterion blocks bid draft',async()=>{
 const p=setup();p.proposal=p.proposal.replace(requirements[1],'omitted acceptance step');
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'acceptance_coverage_incomplete');
});
test('fictional job: unverifiable high accuracy claims are blocked',async()=>{
 const p=setup();p.proposal='Deliverables: Already completed the work; guaranteed acceptance. Verification: perfect.';
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'unsupported_or_unbounded_bid_claims');
});
test('fictional job: missing verification plan blocks bid draft',async()=>{
 const p=setup();p.proposal=p.proposal.replace('Verification:','Checks:');
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'proposal_structure_incomplete');
});
test('fictional job: buyer message missing verification promise blocks bid draft',async()=>{
 const p=setup();p.buyerMessage=p.buyerMessage.replace('verification evidence','some work');
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'buyer_message_not_bound_to_bid');
});
test('fictional job: price above budget blocks bid draft',async()=>{
 const p=setup();p.quoteCents=1100;
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'task_or_price_evidence_incomplete');
});
test('fictional job: quote below verified floor blocks',async()=>{
 const p=setup();p.quoteCents=500;p.task.verified_floor_cents=700;
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'task_or_price_evidence_incomplete');
});
test('fictional job: unverified task metadata or isolated delivery missing blocks',async()=>{
 const p=setup();p.task.delivery_isolated=false;
 assert.equal((await simulateSpriteResubmissionReview(p)).reason,'task_or_price_evidence_incomplete');
});
test('fictional job: received prior bid blocks duplicate regardless of draft quality',async()=>{
 const p=setup();p.existingReservation.state='submitted';
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'already_submitted_do_not_retry');
});
test('fictional job: outstanding reserved row blocks duplicate even when transport has not begun',async()=>{
 const p=setup();p.existingReservation.state='reserved';
 const r=await simulateSpriteResubmissionReview(p);
 assert.equal(r.reason,'existing_reservation_must_be_reconciled');
});
test('fictional job: no escrow metadata does not block evidenced draft review',async()=>{
 const p=setup();delete p.task.escrow_status;
 assert.equal((await simulateSpriteResubmissionReview(p)).state,'fictional_draft_passed_advisory_reviews');
});
test('fictional job: 512 varied unresolved #3298 retries remain held',async()=>{
 const base=setup();base.task.problem_id='3298';base.existingReservation.problem_id='3298';
 base.existingReservation.state='uncertain';base.quoteCents=650;
 let seed=123456789;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 for(let i=0;i<512;i++){
   const p={...base,task:{...base.task},existingReservation:{...base.existingReservation}};
   const which=random()%6;
   if(which===0)p.proposal='guaranteed acceptance today';
   if(which===1)p.quoteCents=2000;
   if(which===2)p.task.verified_budget_cents=0;
   if(which===3)p.novaReview=async()=>({decision:'approve'});
   if(which===4)p.existingReservation.state='uncertain';
   if(which===5)p.buyerMessage='already completed';
   const r=await simulateSpriteResubmissionReview(p);
   assert.equal(r.reason,'unknown_previous_submission_do_not_retry',String(i));
   assert.equal(r.can_submit,false);
 }
});
