// Sprite-only staging protocol: independent Mother + Nova + operator approvals.
// This adapter deliberately cannot issue a bid permit or send marketplace writes.
// No production task may pass: every signer must have stage_only=true and the
// canonical intent must identify the reserved fictional stage task 999999991.
import {canonicalBidIntent} from './council-preflight.mjs';
import {exactCouncilApprovalMessage} from './sprite-signed-council.mjs';
const B64=/^[A-Za-z0-9_-]{40,128}$/;
const hold=reason=>({state:'hold',reason,can_submit:false,stage_only:true});
const bytes=x=>{
 if(typeof x!=='string'||!B64.test(x))return null;
 try{const t=x.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(t+'='.repeat((4-t.length%4)%4)),c=>c.charCodeAt(0));}catch{return null;}
};
const hex=xs=>Array.from(xs??[],x=>x.toString(16).padStart(2,'0')).join('');
function checkedApproval(a,role,intent,now){
 if(!a||a.stage_only!==true||a.reviewer!==role||a.decision!=='approve'
  ||a.problem_id!==intent.problem_id||a.amount_cents!==intent.amount_cents
  ||a.nonce!==intent.nonce||a.canonical_intent!==canonicalBidIntent(intent)
  ||!Number.isSafeInteger(a.approved_at)||a.approved_at<intent.created_at||a.approved_at>now
  ||!Number.isSafeInteger(a.expires_at)||a.expires_at<=now
  ||a.expires_at>intent.created_at+900)return null;
 const msg=exactCouncilApprovalMessage(role,intent,a.approved_at,a.expires_at);
 const sig=bytes(a.signature);
 if(!msg||!sig||sig.length!==64)return null;
 return {msg,sig};
}
export async function verifyStageTripartite({
 intent,mother,nova,operator,motherPublicKeyB64,novaPublicKeyB64,
 operatorPublicKeyB64,nowSec,cryptoApi=crypto
}={}){
 const canonical=canonicalBidIntent(intent);
 if(!canonical||intent.problem_id!=='999999991'||!Number.isSafeInteger(nowSec)
   ||nowSec<intent.created_at||nowSec>=intent.created_at+900)
   return hold('not_an_exact_fictional_stage_intent');
 const k1=bytes(motherPublicKeyB64),k2=bytes(novaPublicKeyB64),k3=bytes(operatorPublicKeyB64);
 if(!k1||!k2||!k3||[k1,k2,k3].some(k=>k.length!==32)
   ||new Set([hex(k1),hex(k2),hex(k3)]).size!==3)
   return hold('three_distinct_trusted_keys_required');
 if(!cryptoApi?.subtle)return hold('private_crypto_missing');
 const reviewers=[['mother',mother,k1],['nova',nova,k2],['chatgpt_operator',operator,k3]];
 for(const [role,approval,pub]of reviewers){
   const valid=checkedApproval(approval,role,intent,nowSec);
   if(!valid)return hold(role+'_exact_approval_invalid');
   try{
    const k=await cryptoApi.subtle.importKey('raw',pub,{name:'Ed25519'},false,['verify']);
    if(await cryptoApi.subtle.verify({name:'Ed25519'},k,valid.sig,
      new TextEncoder().encode(valid.msg))!==true)return hold(role+'_signature_unverified');
   }catch{return hold(role+'_signature_unavailable');}
 }
 return {state:'fictional_three_signatures_verified',can_submit:false,
  stage_only:true,requires_production_reviewer_implementation:true,
  requires_atomic_d1_and_fresh_market_receipt:true,
  problem_id:intent.problem_id};
}
