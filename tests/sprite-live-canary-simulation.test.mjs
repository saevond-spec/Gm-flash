import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchAutonomous,qualifyTask} from '../worker.mjs';
import {prepareBidPlan} from '../bid-solve.mjs';
const now=()=>Math.floor(Date.now()/1000);
function sample(){
 return {problem_id:'3257',profile:'uat_severity_policy',amount_cents:4700,hours:72,cost_cents:0,platform_limit_cents:5500,scope_verified:1,isolated_environment_verified:1,rehearsal_passed:1,verified_at:now()-30,valid_until:now()+1800};
}
const task={id:3257,status:'bidding',currency:'USD',escrow_status:'funded',escrow_funded:true,
 payment_evidence:'funded_escrow',price:5500,escrow_amount:5500,reference_price:5500,deadline:'2026-12-21T15:59:59Z'};
const proposal='Relevance: UAT severity classifications are necessary before release.\nCompleteness: Define four levels, eight fictional examples, priority matrix and release blockers.\nFeasibility: No private access required and only fictional observations are included.\nAcceptance criteria: All three buyer checks will be proved with counts, examples and go-live matrix.\nVerification and evidence: Recalculate and inspect every case, then supply a checklist.\nPrice and scope: $47 within 72 hours; no production testing or personal data.';
function fakeDB(row){return {prepare(sql){return {bind(...values){return {
 async all(){if(sql.includes('FROM autonomous_readiness'))return {results:[row]};throw Error('Unexpected SQL all: '+sql)},
 async first(){if(sql.includes('FROM bid_reservations'))return null;throw Error('Unexpected SQL first: '+sql)}
 }}}}};}
test('canary complete delegated dispatch reaches exactly one simulated reservation and never changes the quoted terms',async()=>{
 const row=sample(),db=fakeDB(row),calls=[];
 const env={BID_LEDGER:db};
 const deps={identity:async()=>({id:1878,name:'Sprite',admission_status:'approved',webhook_url:'https://sprite.test/cph-webhook'}),
 hook:'https://sprite.test/cph-webhook',detail:async(_env,id)=>{assert.equal(String(id),'3257');return task},
 qualify:qualifyTask,plan:prepareBidPlan,
 aiPrepare:async()=>({proposal,buyer_message:'I will document four UAT severity levels, eight fictional examples and priority/go-live criteria.',ai_used:true,amount_cents:4700,hours:72,acceptance_criteria_covered:3}),
 reserve:async(_db,id,amount,send)=>{calls.push(['reserve',id,amount]);return send()},
 send:async(_env,id,amount,text,options)=>{calls.push(['send',id,amount,options?.operatorDelegated]);return {state:'submitted',attempted:true,upstream_status:200}}
 };
 const r=await dispatchAutonomous(env,{candidate_ids:['3257']},deps);
 assert.equal(r.state,'submitted',JSON.stringify(r));
 assert.deepEqual(calls,[['reserve','3257',4700],['send','3257',4700,true]]);
});
test('invalid credential identity does not execute any artificial bid',async()=>{
 const row=sample(),env={BID_LEDGER:fakeDB(row)};let sent=0;
 const deps={identity:async()=>({id:1744,name:'Star',admission_status:'approved',webhook_url:'https://sprite.test/cph-webhook'}),hook:'https://sprite.test/cph-webhook',detail:async()=>task,qualify:qualifyTask,plan:prepareBidPlan,
 aiPrepare:async()=>{throw Error('must not prepare')},reserve:async()=>{sent++},send:async()=>{sent++}};
 const r=await dispatchAutonomous(env,{candidate_ids:['3257']},deps);assert.equal(r.attempted,false);assert.equal(sent,0);
});
