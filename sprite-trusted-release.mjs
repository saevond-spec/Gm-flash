// Sprite-only trusted council adapter. Intended solely for a private Worker
// with pinned Mother, Nova and operator public keys from DEPLOYMENT CONFIG, never requests.
// Neither this function nor any council review can send a marketplace request.
import {canonicalBidIntent,councilBidPreflight} from './council-preflight.mjs';
import {authorizeAndReserveBid} from './council-release.mjs';
import {verifyIndependentSpriteCouncil} from './sprite-signed-council.mjs';

const hold=reason=>({state:'hold',reason,can_submit:false});
export async function reviewSpriteBidWithPinnedSigners({
  intent,motherService,novaService,operatorService,motherPublicKeyB64,novaPublicKeyB64,operatorPublicKeyB64,
  readLedger,nowSec,cryptoApi=crypto
}={}){
  if(!canonicalBidIntent(intent)||intent.problem_id==='3298')return hold('invalid_or_legacy_bid');
  if(!motherService||typeof motherService.reviewBidIntent!=='function'||
     !novaService||typeof novaService.reviewBidIntent!=='function'||
     !operatorService||typeof operatorService.reviewBidIntent!=='function')
    return hold('private_review_services_unavailable');
  if(typeof readLedger!=='function')return hold('private_ledger_unavailable');
  const packet=Object.freeze({
    agent_id:1878,action:'submit_bid',
    problem_id:intent.problem_id,amount_cents:intent.amount_cents,
    canonical_intent:canonicalBidIntent(intent),
    proposal_sha256:intent.proposal_sha256,scope_sha256:intent.scope_sha256,
    nonce:intent.nonce,created_at:intent.created_at
  });
  let mother;
  try{mother=await motherService.reviewBidIntent(packet);}
  catch{return hold('mother_service_unavailable')}
  if(mother?.decision!=='approve')return hold('mother_not_approved');
  let nova;
  try{nova=await novaService.reviewBidIntent(packet);}
  catch{return hold('nova_service_unavailable')}
  if(nova?.decision!=='approve')return hold('nova_not_approved');
  let operator;
  try{operator=await operatorService.reviewBidIntent(packet);}
  catch{return hold('operator_service_unavailable')}
  if(operator?.decision!=='approve')return hold('operator_not_approved');
  const signed=await verifyIndependentSpriteCouncil({
    intent,mother,nova,control:operator,motherPublicKeyB64,novaPublicKeyB64,operatorPublicKeyB64,nowSec,cryptoApi
  });
  if(signed.state!=='verified_tripartite_signatures')return hold(signed.reason);
  // Only the three approval objects verified above are accepted in this exact
  // invocation. The verifier callbacks are NOT provided by HTTP callers.
  const trusted=await councilBidPreflight({
    intent,mother,nova,control:operator,nowSec,readLedger,
    verifyMother:async(a,c)=>a===mother&&c===packet.canonical_intent,
    verifyNova:async(a,c)=>a===nova&&c===packet.canonical_intent,
    verifyControl:async(a,c)=>a===operator&&c===packet.canonical_intent
  });
  if(trusted.state!=='preflight_passed_not_released')return hold(trusted.reason);
  return {state:'signed_preflight_passed_not_released',can_submit:false,
    requires_atomic_reservation:true,problem_id:intent.problem_id,
    mother,nova,control:operator};
}


// Private staged integration point. No public HTTP caller may supply service
// bindings, pinned keys, DB, final-check function, or a fake trusted clock.
// It produces ONLY a scoped reserved grant, never a ClawHunt network request.
export async function reserveSignedSpriteBid({
 intent,motherService,novaService,operatorService,motherPublicKeyB64,novaPublicKeyB64,operatorPublicKeyB64,
 readLedger,independentFinalCheck,db,nowSec,cryptoApi=crypto
}={}){
 const denied=reason=>({state:'hold',reason,can_submit:false,reserved:false});
 const verified=await reviewSpriteBidWithPinnedSigners({
  intent,motherService,novaService,operatorService,motherPublicKeyB64,novaPublicKeyB64,operatorPublicKeyB64,
  readLedger,nowSec,cryptoApi
 });
 if(verified.state!=='signed_preflight_passed_not_released')return denied(verified.reason);
 // The trusted service reviews and public-key checks have already completed
 // in this same scope. Bind the preflight callbacks to the precise reviewed
 // object references and the verified canonical intent; do not accept callbacks
 // from the bid payload or from a different request.
 const expected=canonicalBidIntent(intent);
 return authorizeAndReserveBid({
  intent,mother:verified.mother,nova:verified.nova,control:verified.control,
  verifyMother:async(a,c)=>a===verified.mother&&c===expected,
  verifyNova:async(a,c)=>a===verified.nova&&c===expected,
  verifyControl:async(a,c)=>a===verified.control&&c===expected,
  readLedger,db,nowSec,independentFinalCheck
 });
}
