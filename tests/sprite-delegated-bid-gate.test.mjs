import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDelegatedBidAuthorization as check} from '../sprite-delegated-bid-gate.mjs';
const now=1795520000;
function fixture(){
 const row={problem_id:'3257',amount_cents:4700,platform_limit_cents:5500,profile:'arithmetic_reconciliation',hours:48,cost_cents:0,scope_verified:1,isolated_environment_verified:1,rehearsal_passed:1,verified_at:now-60,valid_until:now+600};
 const task={id:3257,status:'bidding',currency:'USD',escrow_status:'funded',deadline:'2026-12-21T15:59:59Z'};
 const payload={amount:4700,message:'Specific UAT defect severity buyer message meeting all acceptance criteria.',proposal_text:'Four severity levels, eight fictional examples, P0-P3 priorities, release blocker matrix, and reproducible acceptance checklist. Timeline 48h.',estimated_time:'48 hours'};
 return {policy:{operator_authorized:true,automatic_submission_enabled:true},agent:{id:1878,name:'Sprite',admission_status:'approved'},row,task,assessment:{eligible:true,simulated_flag:false,budget_cents:5500},bounds:{ok:true,problem_id:'3257',budget_cents:5500,price_floor_cents:275},payload,canonicalPayload:JSON.stringify(payload),nowSeconds:now};
}
test('approved operator-authorized task passes without Mother/Nova signatures',()=>assert.deepEqual(check(fixture()).reasons,[]));
for(const [name,breakIt,reason] of [
 ['operator grant missing',x=>x.policy.operator_authorized=false,'operator_delegation_disabled'],
 ['disabled automatic send',x=>x.policy.automatic_submission_enabled=false,'operator_delegation_disabled'],
 ['wrong agent',x=>x.agent.id=1744,'sprite_identity_not_approved'],
 ['wrong agent name',x=>x.agent.name='Star','sprite_identity_not_approved'],
 ['unapproved agent',x=>x.agent.admission_status='pending','sprite_identity_not_approved'],
 ['task id substitution',x=>x.task.id=3256,'task_identity_mismatch'],
 ['past deadline',x=>x.task.deadline='2026-11-23T15:59:59Z','deadline_expired_or_invalid'],
 ['unverified scope',x=>x.row.scope_verified=0,'scope_isolation_or_rehearsal_not_verified'],
 ['missing isolation',x=>x.row.isolated_environment_verified=0,'scope_isolation_or_rehearsal_not_verified'],
 ['missing rehearsal',x=>x.row.rehearsal_passed=0,'scope_isolation_or_rehearsal_not_verified'],
 ['extra execution cost',x=>x.row.cost_cents=1,'scope_isolation_or_rehearsal_not_verified'],
 ['expired readiness',x=>x.row.valid_until=now-1,'readiness_stale'],
 ['unsupported work',x=>x.row.profile='blender_3d','unsupported_delivery_profile'],
 ['under $20 minimum',x=>{x.row.amount_cents=1900;x.payload.amount=1900},'operator_quote_bounds'],
 ['over marketplace budget',x=>{x.row.amount_cents=5600;x.row.platform_limit_cents=6000;x.payload.amount=5600},'marketplace_quote_bounds'],
 ['fake budget',x=>x.assessment.budget_cents=9000,'live_marketplace_evidence_invalid'],
 ['not eligible',x=>x.assessment.eligible=false,'live_marketplace_evidence_invalid'],
 ['missing proposal',x=>x.payload.proposal_text='bad','buyer_copy_incomplete'],
 ['unfrozen payload',x=>x.canonicalPayload='invalid','payload_not_frozen'],
 ['unknown currency',x=>x.task.currency='EUR','task_not_biddable']
]){
 test('reject '+name,()=>{const x=fixture();breakIt(x);assert.equal(check(x).ok,false);assert.ok(check(x).reasons.includes(reason));});
}
test('no external signer or credential field affects authorization',()=>{const x=fixture();x.mother={decision:'hold'};x.nova={decision:'hold'};assert.equal(check(x).ok,true);});

test('25,000 deterministic quote-floor and deadline combinations never authorize out-of-bounds bids',()=>{
 let seed=0x5eed1234;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 let eligible=0,denied=0;
 for(let i=0;i<25000;i++){
  const x=fixture(),budget=2000+random()%98001,floor=Math.max(100,Math.ceil(budget*0.05));
  const quote=random()%120000;const cap=2000+random()%98001;const deadlineValid=random()%5!==0;
  x.row.amount_cents=quote;x.row.platform_limit_cents=cap;
  x.bounds.budget_cents=budget;x.bounds.price_floor_cents=floor;
  x.assessment.budget_cents=budget;x.payload.amount=quote;
  x.task.deadline=deadlineValid?'2026-12-21T15:59:59Z':'2026-11-23T15:59:59Z';
  x.canonicalPayload=JSON.stringify(x.payload);
  const allowed=deadlineValid&&quote>=2000&&quote<=100000&&quote>=floor&&quote<=budget&&quote<=cap;
  const actual=check(x);assert.equal(actual.ok,allowed,'iteration '+i+' budget='+budget+' floor='+floor+' quote='+quote+' cap='+cap);
  if(actual.ok)eligible++;else denied++;
 }
 assert.equal(eligible+denied,25000);
});
