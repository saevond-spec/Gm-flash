// Sprite-only PRIVATE scheduled staging RPC probe. No public fetch, marketplace
// credentials, external networking, live job, or production D1 binding.
// Uses ONLY fictional task 999999991 and records Boolean results in isolated D1.
import {canonicalBidIntent} from './council-preflight.mjs';
import {exactCouncilApprovalMessage} from './sprite-signed-council.mjs';
const taskId='999999991';
const motherPub='4rjfqaeUEtMQLjLP-yhSxYpYg2ISKmG1lpGhFc3-9Mc';
const novaPub='PYwiUP8n2Okd47z4ASbooUhWJbOcv6Dtjb6llov3bHY';
function decode(s){
 try{const x=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(x+'='.repeat((4-x.length%4)%4)),c=>c.charCodeAt(0));}catch{return null;}
}
async function verified(role,packet,intent,pub,nowSec){
 if(!packet||packet.stage_only!==true||packet.can_submit!==false
    ||packet.reviewer!==role||packet.decision!=='approve'
    ||packet.problem_id!==intent.problem_id||packet.amount_cents!==intent.amount_cents
    ||packet.nonce!==intent.nonce||packet.canonical_intent!==canonicalBidIntent(intent)
    ||packet.approved_at>nowSec||packet.expires_at<=nowSec)return false;
 const b=decode(packet.signature),p=decode(pub);
 if(b?.length!==64||p?.length!==32)return false;
 const msg=exactCouncilApprovalMessage(role,intent,packet.approved_at,packet.expires_at);
 if(!msg)return false;
 try{
  const key=await crypto.subtle.importKey('raw',p,{name:'Ed25519'},false,['verify']);
  return await crypto.subtle.verify({name:'Ed25519'},key,b,new TextEncoder().encode(msg))===true;
 }catch{return false;}
}
export default {
 async scheduled(_event,env,_ctx){
  const now=Math.floor(Date.now()/1000);
  const intent={agent_id:1878,problem_id:taskId,amount_cents:750,
    verified_budget_cents:1000,verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,
    proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),
    nonce:'c'.repeat(32),created_at:now-5};
  const canonical=canonicalBidIntent(intent);
  const motherEvidence={stage_marker:'sprite-fictional-council-v1',
   source:'fictional_mother_evidence',canonical_intent:canonical,agent_id:1878,
   problem_id:taskId,nonce:intent.nonce,collected_at:now-2,task_status:'bidding',
   currency:'USD',budget_cents:1000,floor_cents:500,own_bid_exists:false,
   incremental_cost_cents:0,isolated_delivery:true,scope_sha256:intent.scope_sha256,
   proposal_sha256:intent.proposal_sha256,deadline_feasible:true,
   acceptance:[
    {id:'check-1',requirement:'Deliver fictional CSV with complete row counts',verification_method:'Recompute the fictional row total',deliverable_isolated:true},
    {id:'check-2',requirement:'Document fictional transformation reproducibility',verification_method:'Independently replay the test transform',deliverable_isolated:true}
   ]};
  const novaEvidence={stage_marker:'sprite-fictional-council-v1',
   source:'fictional_nova_evidence',canonical_intent:canonical,agent_id:1878,
   problem_id:taskId,nonce:intent.nonce,observed_at:now-2,
   agent_standing:'eligible',owner_active:true,heartbeat_age_sec:2,
   market_bid_allowed:true,duplicate_bid_detected:false,
   currency:'USD',task_status:'bidding',simulated_task:true,
   verified_budget_cents:1000,verified_floor_cents:500,quote_cents:750,
   proposal_sha256:intent.proposal_sha256,scope_sha256:intent.scope_sha256,
   delivery_feasible:true,incremental_cost_cents:0,
   reservation_conflict:false,nonce_seen:false};
  let m=null,n=null,badMother=null,badNova=null,err='';
  try{
   const results=await Promise.all([
    env.MOTHER_STAGE.reviewBidIntent({intent,evidence:motherEvidence}),
    env.NOVA_STAGE.reviewBidIntent({intent,evidence:novaEvidence}),
    env.MOTHER_STAGE.reviewBidIntent({intent:{...intent,problem_id:'3298'},evidence:motherEvidence}),
    env.NOVA_STAGE.reviewBidIntent({intent:{...intent,problem_id:'3298'},evidence:novaEvidence})
   ]);
   [m,n,badMother,badNova]=results;
  }catch(e){err=String(e).slice(0,180);}
  const mv=await verified('mother',m,intent,motherPub,now);
  const nv=await verified('nova',n,intent,novaPub,now);
  const bm=badMother?.decision==='hold'&&badMother?.can_submit===false;
  const bn=badNova?.decision==='hold'&&badNova?.can_submit===false;
  await env.STAGE_LEDGER.prepare(
   'INSERT INTO stage_rpc_checks(observed_at,mother_approved,mother_verified,nova_approved,nova_verified,bad_mother_held,bad_nova_held,error_text) VALUES(?,?,?,?,?,?,?,?)'
  ).bind(now,m?.decision==='approve'?1:0,mv?1:0,n?.decision==='approve'?1:0,nv?1:0,bm?1:0,bn?1:0,err).run();
 },
 async fetch(){return new Response(null,{status:403,headers:{'cache-control':'no-store'}});}
};