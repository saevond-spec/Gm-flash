// Sprite-ONLY STAGING WorkerEntrypoint for independent mother review.
// No ClawHunt key, no live task, no market POST, and no production bindings.
// The 999999991 fixture is synthetic, never an actual bounty. Never reuse
// these signing keys as production council keys.
import {WorkerEntrypoint} from 'cloudflare:workers';
import {reviewMotherStageBid} from './sprite-mother-review-policy.mjs';
import {exactCouncilApprovalMessage} from './sprite-signed-council.mjs';
const ROLE='mother';
function bytesFromB64Url(t){
 if(typeof t!=='string'||!/^[A-Za-z0-9_-]{20,512}$/.test(t))return null;
 const text=t.replace(/-/g,'+').replace(/_/g,'/');
 try{return Uint8Array.from(atob(text+'='.repeat((4-text.length%4)%4)),x=>x.charCodeAt(0));}catch{return null}
}
function toB64Url(bytes){
 const a=Array.from(new Uint8Array(bytes),x=>String.fromCharCode(x)).join('');
 return btoa(a).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
const stopped=reason=>({reviewer:ROLE,decision:'hold',reason,stage_only:true,can_submit:false});
export default class SpriteStageBidReview extends WorkerEntrypoint {
 async reviewBidIntent({intent,evidence}={}){
  const nowSec=Math.floor(Date.now()/1000);
  const verdict=reviewMotherStageBid({intent,evidence,nowSec});
  if(verdict.state!=='eligible_for_stage_signature')return stopped(verdict.reason);
  // Key only exists in private Cloudflare Worker secret binding.
  // Missing key and any crypto failure must keep HOLD.
  const keyBytes=bytesFromB64Url(this.env?.STAGE_PRIVATE_PKCS8);
  if(!keyBytes)return stopped('separate_stage_signing_key_missing');
  const expiresAt=Math.min(nowSec+300,intent.created_at+900);
  const message=exactCouncilApprovalMessage(ROLE,intent,nowSec,expiresAt);
  if(!message)return stopped('exact_intent_signing_message_invalid');
  try{
   const key=await crypto.subtle.importKey('pkcs8',keyBytes,{name:'Ed25519'},false,['sign']);
   const sig=await crypto.subtle.sign({name:'Ed25519'},key,new TextEncoder().encode(message));
   return {reviewer:ROLE,decision:'approve',problem_id:intent.problem_id,
     amount_cents:intent.amount_cents,nonce:intent.nonce,
     canonical_intent:verdict.canonical_intent,
     approved_at:nowSec,expires_at:expiresAt,
     signature:toB64Url(sig),stage_only:true,can_submit:false};
  }catch{return stopped('independent_stage_signing_failed');}
 }
 async stageHealth(){return {role:ROLE,stage_only:true,signer_configured:!!this.env?.STAGE_PRIVATE_PKCS8,
   production_bid_release:false,marketplace_write:false};}
 async fetch(){return new Response(null,{status:403,headers:{'cache-control':'no-store'}});}
}