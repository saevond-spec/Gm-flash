import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeSpriteOperatorBidQueue as consume} from '../sprite-direct-operator-queue.mjs';
const NOW=1795679000;
const row=(x={})=>({problem_id:'4188',agent_id:1878,amount_ceiling_cents:9000,
 issued_at:NOW-100,expires_at:NOW+600,...x});
function ledger(initial=row(),{claimMiss=false,failFinish=false,failPeek=false}={}){
 const state={row:initial?{...initial,state:'queued'}:null,calls:[]};
 return {state,db:{prepare(sql){
  const op=sql.includes("FROM sprite_operator_bid_requests_v1")?'peek':
   sql.includes("SET state='processing'")?'claim':
   sql.includes("SET state=?,result_code=?")?'finish':'unknown';
  const args=[];return {bind(...values){args.push(...values);return this},
   async first(){state.calls.push({op,args:[...args]});
    if(op==='peek'){if(failPeek)throw Error('read-failed');return state.row?.state==='queued'?{...state.row}:null;}
    if(op==='claim'){if(claimMiss)return null;if(state.row?.state!=='queued'||state.row.problem_id!==args[0])return null;
      state.row.state='processing';return {...state.row};}
    throw Error('unexpected SELECT')},
   async run(){state.calls.push({op,args:[...args]});
    if(op!=='finish')throw Error('unexpected update');
    if(failFinish)throw Error('d1 write rejected');
    state.row.state=args[0];state.row.result_code=args[1];return {success:true};
   }}}
 }};
}
const execute=async(given=row(),sender=async()=>({state:'authenticated_bid_confirmed',attempted:true,confirmed:true}),options={})=>{
 const ctx=ledger(given,options);const calls=[];const outcome=await consume({
 db:ctx.db,nowSeconds:NOW,submitSpriteDirectOnce:async args=>{calls.push(args);return sender(args)}
 });return {outcome,ctx,calls};
};
test('one-shot successful bid requires actual authenticated receipt result',async()=>{
 const x=await execute();assert.equal(x.outcome.state,'confirmed');
 assert.equal(x.outcome.confirmed,true);assert.equal(x.ctx.state.row.state,'confirmed');
 assert.equal(x.calls.length,1);assert.equal(x.calls[0].problem_id,'4188');
 assert.equal(x.calls[0].max_authorized_quote_cents,9000);
});
test('empty queue is no-op',async()=>{
 const x=await execute(null);assert.equal(x.outcome.state,'empty');assert.equal(x.calls.length,0);
});
test('missing D1 returns not configured',async()=>{
 const x=await consume({db:null,submitSpriteDirectOnce:async()=>({})});
 assert.equal(x.state,'unconfigured');assert.equal(x.attempted,false);
});
test('expired operator authorization cannot send',async()=>{
 const x=await execute(row({expires_at:NOW-1}));
 assert.equal(x.outcome.state,'operator_request_expired');assert.equal(x.calls.length,0);
});
test('future authorization cannot send',async()=>{
 const x=await execute(row({issued_at:NOW+200,expires_at:NOW+500}));
 assert.equal(x.outcome.state,'operator_request_expired');assert.equal(x.calls.length,0);
});
test('invalid task ID held before claim/send',async()=>{
 const x=await execute(row({problem_id:'4188 OR 1=1'}));
 assert.equal(x.outcome.state,'invalid_queue_request');assert.equal(x.calls.length,0);
});
test('invalid price ceiling held',async()=>{
 const x=await execute(row({amount_ceiling_cents:200000}));
 assert.equal(x.outcome.state,'invalid_queue_request');assert.equal(x.calls.length,0);
});
test('claim failure does not send',async()=>{
 const x=await execute(row(),undefined,{claimMiss:true});
 assert.equal(x.outcome.state,'already_claimed');assert.equal(x.calls.length,0);
});
test('missing capability proof is hold, not a simulated bid',async()=>{
 const x=await execute(row(),async()=>({state:'prebid_evidence_incomplete',attempted:false,confirmed:false}));
 assert.equal(x.outcome.state,'held');assert.equal(x.outcome.attempted,false);
});
test('known simulated task is held',async()=>{
 const x=await execute(row(),async()=>({state:'simulated_bounty_excluded',attempted:false,confirmed:false}));
 assert.equal(x.outcome.state,'held');assert.equal(x.ctx.state.row.state,'held');
});
test('duplicate marketplace bid is rejected without another send',async()=>{
 const x=await execute(row(),async()=>({state:'existing_bid_requires_reconciliation',attempted:false}));
 assert.equal(x.outcome.state,'rejected');assert.equal(x.ctx.state.row.state,'rejected');
});
test('transport exception marks uncertain, never retries',async()=>{
 const x=await execute(row(),async()=>{throw Error('unknown if POST committed')});
 assert.equal(x.outcome.state,'uncertain_do_not_retry');assert.equal(x.calls.length,1);
 assert.equal(x.ctx.state.row.state,'uncertain');
});
test('HTTP 200 without receipt is uncertain',async()=>{
 const x=await execute(row(),async()=>({state:'receipt_mismatch_do_not_retry',attempted:true,confirmed:false}));
 assert.equal(x.outcome.state,'uncertain');assert.equal(x.outcome.confirmed,false);
});
test('claimed request is never fetched twice',async()=>{
 const ctx=ledger();let count=0;const deps={db:ctx.db,nowSeconds:NOW,submitSpriteDirectOnce:async()=>{count++;return {state:'prebid_evidence_incomplete',attempted:false}}};
 await consume(deps);const two=await consume(deps);
 assert.equal(count,1);assert.equal(two.state,'empty');
});
test('failed status persistence never claims confirmed',async()=>{
 const x=await execute(row(),undefined,{failFinish:true});
 assert.equal(x.outcome.state,'queue_status_write_failed');assert.equal(x.outcome.confirmed,false);
});
test('read failure does not submit',async()=>{
 const x=await execute(row(),undefined,{failPeek:true});
 assert.equal(x.outcome.state,'queue_unavailable');assert.equal(x.calls.length,0);
});
test('only public task ID and monetary ceiling passed to sender',async()=>{
 const x=await execute(row({customer_secret:'PRIVATE-DOCUMENT-DO-NOT-SHARE'}));
 assert.ok(!JSON.stringify(x.calls).includes('PRIVATE-DOCUMENT-DO-NOT-SHARE'));
});
