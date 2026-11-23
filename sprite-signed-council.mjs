// Sprite-only cryptographic verifier for two independent council reviewers.
// The TWO public keys must be supplied by trusted private deployment configuration,
// NEVER by a public request or task description. This module never signs approvals.
import {canonicalBidIntent} from './council-preflight.mjs';

const DECIMAL=/^[1-9][0-9]{0,9}$/;
const validInt=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const B64URL=/^[A-Za-z0-9_-]+$/;
function decodeBase64Url(value,expectedLength){
  if(typeof value!=='string'||!B64URL.test(value)||value.length>256)return null;
  try{
    const plain=value.replace(/-/g,'+').replace(/_/g,'/');
    const padded=plain+'='.repeat((4-plain.length%4)%4);
    const binary=atob(padded);
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    if(bytes.length!==expectedLength)return null;
    return bytes;
  }catch{return null}
}
const equalBytes=(a,b)=>{
  if(!a||!b||a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
};
export function exactCouncilApprovalMessage(role,intent,approvedAt,expiresAt){
  const canonical=canonicalBidIntent(intent);
  if(!canonical||!['mother','nova','chatgpt_operator'].includes(role)
    ||!validInt(approvedAt,intent.created_at,intent.created_at+899)
    ||!validInt(expiresAt,approvedAt+1,intent.created_at+900))return null;
  return 'sprite-signed-review-v1|'+role+'|'+canonical+'|'+approvedAt+'|'+expiresAt;
}
async function checkApproval({role,approval,intent,keyBytes,nowSec,cryptoApi}){
  if(!approval||approval.reviewer!==role||approval.decision!=='approve'
    ||approval.problem_id!==intent.problem_id||approval.amount_cents!==intent.amount_cents
    ||approval.nonce!==intent.nonce||approval.canonical_intent!==canonicalBidIntent(intent)
    ||!validInt(approval.approved_at,intent.created_at,nowSec)
    ||!validInt(approval.expires_at,nowSec+1,intent.created_at+900))return false;
  const message=exactCouncilApprovalMessage(role,intent,approval.approved_at,approval.expires_at);
  const signature=decodeBase64Url(approval.signature,64);
  if(!message||!signature)return false;
  try{
    const key=await cryptoApi.subtle.importKey('raw',keyBytes,{name:'Ed25519'},false,['verify']);
    return await cryptoApi.subtle.verify({name:'Ed25519'},key,signature,new TextEncoder().encode(message))===true;
  }catch{return false}
}
export async function verifyIndependentSpriteCouncil({
  intent,nova,control,novaPublicKeyB64,operatorPublicKeyB64,nowSec,cryptoApi=crypto
}={}){
  const deny=reason=>({state:'hold',reason,can_submit:false});
  if(!canonicalBidIntent(intent)||!validInt(nowSec,intent?.created_at??0,(intent?.created_at??0)+899)
    ||!DECIMAL.test(intent.problem_id)||intent.problem_id==='3298')
    return deny('intent_invalid_or_legacy');
  const nKey=decodeBase64Url(novaPublicKeyB64,32);
  const oKey=decodeBase64Url(operatorPublicKeyB64,32);
  if(!nKey||!oKey||equalBytes(nKey,oKey))
    return deny('distinct_trusted_public_keys_missing');
  if(!cryptoApi||!cryptoApi.subtle)return deny('crypto_unavailable');
  if(!await checkApproval({role:'nova',approval:nova,intent,keyBytes:nKey,nowSec,cryptoApi}))
    return deny('nova_signature_or_binding_invalid');
  if(!await checkApproval({role:'chatgpt_operator',approval:control,intent,keyBytes:oKey,nowSec,cryptoApi}))
    return deny('operator_signature_or_binding_invalid');
  // Independent crypto verification is still not permission to POST:
  // the ledger, task readiness, expiry, and atomic reservation remain required.
  return {state:'verified_dual_signatures',can_submit:false,
    requires_atomic_reservation:true,problem_id:intent.problem_id};
}
