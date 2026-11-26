import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeSpriteOperatorBidQueue as consume} from '../sprite-direct-operator-queue.mjs';
import {submitSpriteDirectOnce as submit} from '../sprite-direct-bid-orchestrator.mjs';
const now=Date.parse('2026-11-26T07:50:00Z');
const SHA='sha256:'+'a'.repeat(64);
const agent=()=>({id:1878,authenticated:true,admission_status:'approved',
  webhook_matches_approved_sprite:true});
function task(over={}){
 return {id:'4188',authenticated:true,identity_verified:true,
  public_only_brief_verified:true,fetched_at:'2026-11-26T07:49:10Z',
  status:'bidding',currency:'USD',simulated:false,bounty_type:'escrowed',
  escrow_status:'funded',escrow_funded:true,payment_evidence:'funded_escrow',
  escrow_amount:9000,price:9000,deadline:'2026-12-01T19:00:00Z',...over};
}
function proposal(over={}){
 return {task_id:'4188',amount_cents:8500,additional_spend_cents:0,
 capability_verified:true,can_deliver_public_brief:true,estimated_hours:60,
 approach:'Deliver a reproducible public-only task with an independently checkable work plan.',
 verification_plan:'Check task-specific outputs against public acceptance requirements and proof.',
 buyer_message:'I can provide the documented workflow and verification evidence.',
 ...over};
}
function fixture({taskOverride={},proposalOverride={},proof=null}={}){
 const state={row:{problem_id:'4188',agent_id:1878,amount_ceiling_cents:9000,
  issued_at:Math.floor(now/1000)-120,expires_at:Math.floor(now/1000)+600,
  state:'queued'},sent:0,receipts:0};
 const db={prepare(sql){const params=[];
  const op=sql.includes("FROM sprite_operator_bid_requests_v1")?'peek':
    sql.includes("SET state='processing'")?'claim':'finish';
  return {bind(...x){params.push(...x);return this},
   async first(){if(op==='peek')return state.row?.state==='queued'?{...state.row}:null;
     if(op==='claim'){if(state.row.state!=='queued')return null;
      state.row.state='processing';return {...state.row};}throw Error('unexpected')},
   async run(){if(op!=='finish')throw Error('unexpected');
     state.row.state=params[0];state.row.result_code=params[1];return {}}}}
 };
 const deps={
  getSpriteIdentity:async()=>agent(),
  getAuthenticatedTask:async()=>task(taskOverride),
  getPublicAuthenticityEvidence:async()=>({}),
  getOwnBidHistory:async()=>({authoritative:true,own_marketplace_bid:false,reservation:false,receipt:false,uncertain:false}),
  getVerifiedBlenderProof:async()=>proof,
  createPublicOnlyProposal:async()=>proposal(proposalOverride),
  reserveAndSendOnce:async()=>{state.sent++;return {outcome:'posted',attempted:true}},
  readAuthenticatedBidReceipt:async()=>{state.receipts++;return {agent_id:1878,
    problem_id:'4188',amount_cents:8500,bid_id:'real-id-from-marketplace-example',status:'pending'}}
 };
 return {state,db,deps};
}
test('realistic Blender task with no equipment proof is held; zero POST',async()=>{
 const f=fixture({taskOverride:{title:'Blender bedroom scene',description:'Realistic Blender scene with human guidance'}});
 const result=await consume({db:f.db,nowSeconds:Math.floor(now/1000),submitSpriteDirectOnce:
  props=>submit({...props,deps:f.deps})});
 assert.equal(result.state,'held');assert.equal(f.state.sent,0);assert.equal(f.state.receipts,0);
});
test('non-Blender, otherwise verified public task traverses one send and one receipt',async()=>{
 const f=fixture({taskOverride:{title:'Public reporting task',description:'Document public findings'}});
 const result=await consume({db:f.db,nowSeconds:Math.floor(now/1000),submitSpriteDirectOnce:
  props=>submit({...props,deps:f.deps})});
 assert.equal(result.state,'confirmed');assert.equal(f.state.sent,1);assert.equal(f.state.receipts,1);
});
test('fake paid-status field cannot pass simulation evidence gate',async()=>{
 const f=fixture({taskOverride:{title:'Public report',simulated:null,bounty_type:'simulated'}});
 const result=await consume({db:f.db,nowSeconds:Math.floor(now/1000),submitSpriteDirectOnce:
  props=>submit({...props,deps:f.deps})});
 assert.equal(result.state,'held');assert.equal(f.state.sent,0);
});
test('quote ceiling below proposal blocks send at final step',async()=>{
 const f=fixture();f.state.row.amount_ceiling_cents=8000;
 const result=await consume({db:f.db,nowSeconds:Math.floor(now/1000),submitSpriteDirectOnce:
  props=>submit({...props,deps:f.deps})});
 assert.equal(result.state,'held');assert.equal(f.state.sent,0);
});
test('unknown previously placed bid prevents send',async()=>{
 const f=fixture();f.deps.getOwnBidHistory=async()=>({authoritative:true,uncertain:true});
 const result=await consume({db:f.db,nowSeconds:Math.floor(now/1000),submitSpriteDirectOnce:
  props=>submit({...props,deps:f.deps})});
 assert.equal(result.state,'rejected');assert.equal(f.state.sent,0);
});
