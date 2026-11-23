import test from 'node:test';
import assert from 'node:assert/strict';
import {assessClawhuntBidGates} from '../clawhunt-market-gates.mjs';
const t=1800000000;
const message='Clean the fictional input rows, validate every arithmetic total, produce a reproducible output CSV, and show the exact acceptance checks.';
const make=()=>({
 nowSec:t,
 intent:{agent_id:1878,problem_id:'9991',amount_cents:650},
 agent:{source:'authenticated_me',verified:true,agent_id:1878,admission_status:'approved',owner_active:true},
 standing:{source:'authenticated_standing',verified:true,held_back:false,account_paused:false,
   own_bid_exists:false,eligible_for_task:true,task_id:'9991',checked_at_sec:t-10},
 criteria:{source:'official_criteria',verified:true,checked_at_sec:t-10,
   min_combined_characters:60,heartbeat_window_sec:900},
 heartbeat:{status:200,agent_id:1878,ack_sec:t-30},
 task:{source:'authenticated_detail',verified:true,id:'9991',currency:'USD',status:'open',
   simulated:false,funding_status:'held',self_owned:false,own_bid_exists:false,
   price_floor_cents:500,budget_cents:700,checked_at_sec:t-10,
   acceptance_verified:true,isolated_delivery_verified:true,zero_incremental_cost:true,
   deadline_feasible:true,acceptance_ids:['a','b','c'],covered_acceptance_ids:['a','b','c']},
 proposalText:message,
});
test('realistic verified $6.50 job passes review only, never grants submission',()=>{
 const x=assessClawhuntBidGates(make());assert.equal(x.eligible_for_further_independent_approval,true);
 assert.equal(x.can_submit,false);assert.deepEqual(x.reasons,[]);
});
const cases=[
 ['no official criteria',x=>{x.criteria=null},'current_official_criteria_missing'],
 ['unknown dynamic threshold',x=>{delete x.criteria.min_combined_characters},'current_official_criteria_missing'],
 ['stale criteria response',x=>{x.criteria.checked_at_sec=t-301},'current_official_criteria_missing'],
 ['stale marketplace heartbeat',x=>{x.heartbeat.ack_sec=t-901},'heartbeat_stale_or_unacknowledged'],
 ['ordinary browse is not heartbeat',x=>{x.heartbeat.status=0},'heartbeat_stale_or_unacknowledged'],
 ['agent denied admission',x=>{x.agent.admission_status='pending'},'agent_admission_or_owner_not_verified'],
 ['owner account inactive',x=>{x.agent.owner_active=false},'agent_admission_or_owner_not_verified'],
 ['marketplace standing pause',x=>{x.standing.account_paused=true},'standing_unknown_or_held_back'],
 ['model selection held back',x=>{x.standing.held_back=true},'standing_unknown_or_held_back'],
 ['already has a bid',x=>{x.standing.own_bid_exists=true},'standing_unknown_or_held_back'],
 ['standing belongs to another task',x=>{x.standing.task_id='9992'},'standing_unknown_or_held_back'],
 ['standing has no task identity',x=>{delete x.standing.task_id},'standing_unknown_or_held_back'],
 ['own posted task',x=>{x.task.self_owned=true},'task_status_price_funding_unknown_or_changed'],
 ['verified budget not present',x=>{x.task.budget_cents=null},'task_status_price_funding_unknown_or_changed'],
 ['price floor rises from $5 to $7',x=>{x.task.price_floor_cents=700},'task_status_price_funding_unknown_or_changed'],
 ['budget drops below $6.50',x=>{x.task.budget_cents=600},'task_status_price_funding_unknown_or_changed'],
 ['task closed',x=>{x.task.status='awarded'},'task_status_price_funding_unknown_or_changed'],
 ['task is simulated',x=>{x.task.simulated=true},'task_status_price_funding_unknown_or_changed'],
 ['detail is stale',x=>{x.task.checked_at_sec=t-301},'task_status_price_funding_unknown_or_changed'],
 ['different task id',x=>{x.task.id='9992'},'task_status_price_funding_unknown_or_changed'],
 ['missing isolated delivery',x=>{x.task.isolated_delivery_verified=false},'delivery_scope_or_zero_cost_not_proven'],
 ['cannot meet deadline',x=>{x.task.deadline_feasible=false},'delivery_scope_or_zero_cost_not_proven'],
 ['cost greater than $0',x=>{x.task.zero_incremental_cost=false},'delivery_scope_or_zero_cost_not_proven'],
 ['missing acceptance criterion',x=>{x.task.covered_acceptance_ids=['a','b']},'acceptance_coverage_not_verified'],
 ['duplicate criterion instead of coverage',x=>{x.task.covered_acceptance_ids=['a','b','b']},'acceptance_coverage_not_verified'],
 ['placeholder message filtered',x=>{x.proposalText='Placeholder '+message},'proposal_text_rejected'],
 ['lorem ipsum filtered',x=>{x.proposalText='LOREM IPSUM '+message},'proposal_text_rejected'],
 ['Chinese placeholder filtered',x=>{x.proposalText='占位 '+message},'proposal_text_rejected'],
 ['too short message',x=>{x.proposalText='We can do this.'},'proposal_text_rejected'],
 ['no authenticated standing',x=>{x.standing.source='public_web'},'standing_unknown_or_held_back'],
 ['incorrect agent id',x=>{x.agent.agent_id=9999},'agent_admission_or_owner_not_verified']
];
for(const [name,mutate,expected]of cases)test('realistic gate blocks '+name,()=>{
 const x=make();mutate(x);
 const r=assessClawhuntBidGates(x);
 assert.equal(r.eligible_for_further_independent_approval,false,name);
 assert.ok(r.reasons.includes(expected),name+':'+JSON.stringify(r.reasons));
 assert.equal(r.can_submit,false);
});
test('adversarial 2,048-scenario deterministic mutation campaign rejects every single-gate failure',()=>{
 let seed=0x18fe9023;
 const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 for(let i=0;i<2048;i++){
   const x=make();
   if(i%2===0)x.task.checked_at_sec=t-10+(next()%10);
   const entry=cases[next()%cases.length];
   entry[1](x);
   const r=assessClawhuntBidGates(x);
   assert.equal(r.eligible_for_further_independent_approval,false,'iteration '+i+' '+entry[0]);
   assert.equal(r.can_submit,false);
   assert.ok(!JSON.stringify(r).includes(message));
 }
});

test('unescrowed listing is eligible for independent review and not guaranteed to pay',()=>{
 const x=make();x.task.funding_status='none';
 const r=assessClawhuntBidGates(x);
 assert.equal(r.eligible_for_further_independent_approval,true);
 assert.equal(r.escrow_observation,'unescrowed');
 assert.equal(r.payout_is_guaranteed,false);
 assert.equal(r.can_submit,false);
});
test('missing escrow field is not a disqualifier',()=>{
 const x=make();delete x.task.funding_status;
 const r=assessClawhuntBidGates(x);
 assert.equal(r.eligible_for_further_independent_approval,true);
 assert.equal(r.escrow_observation,'unknown');
 assert.equal(r.can_submit,false);
});
test('unescrowed job still must meet all independent USD budget and scope checks',()=>{
 const x=make();x.task.funding_status='none';x.task.budget_cents=600;
 const r=assessClawhuntBidGates(x);
 assert.equal(r.eligible_for_further_independent_approval,false);
 assert.equal(r.can_submit,false);
});
