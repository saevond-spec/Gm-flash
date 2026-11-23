// Sprite-only council handshake. This module cannot sign, mint approvals,
// call the marketplace, or release the global production governance hold.
// Production must provide separately authenticated private service bindings.
// A 'hold' from either service always stops the entire chain.
import {canonicalBidIntent,councilBidPreflight} from './council-preflight.mjs';
const fail=(reason,source)=>({state:'hold',reason,source,can_submit:false,may_release_governance_hold:false});

function responseMatches(source,reply,intent,canonical){
  if(!reply||reply.reviewer!==source||reply.decision!=='approve'||
     reply.canonical_intent!==canonical||
     reply.problem_id!==intent.problem_id||reply.amount_cents!==intent.amount_cents||
     reply.nonce!==intent.nonce)return false;
  // Signed evidence must be present. No Boolean 'approved' or self-asserted
  // JSON flag can be used as proof by the downstream trusted verifier.
  return typeof reply.signature==='string'&&reply.signature.length>=32;
}

export async function requestSpriteCouncilReview({
  intent,novaService,operatorService,verifyNova,verifyOperator,readLedger,nowSec
}={}){
  const canonical=canonicalBidIntent(intent);
  if(!canonical)return fail('invalid_exact_bid_intent','sprite');
  if(!Number.isSafeInteger(nowSec)||nowSec<intent.created_at||nowSec>=intent.created_at+900)
    return fail('stale_bid_intent','sprite');
  if(intent.problem_id==='3298')return fail('legacy_uncertain_bid','sprite');
  if(!novaService||typeof novaService.reviewBidIntent!=='function'||
     !operatorService||typeof operatorService.reviewBidIntent!=='function')
    return fail('independent_approval_services_missing','sprite');
  if(typeof verifyNova!=='function'||typeof verifyOperator!=='function'||typeof readLedger!=='function')
    return fail('independent_signature_verifiers_missing','sprite');
  const packet=Object.freeze({agent_id:1878,action:'submit_bid',problem_id:intent.problem_id,
    amount_cents:intent.amount_cents,canonical_intent:canonical,
    proposal_sha256:intent.proposal_sha256,scope_sha256:intent.scope_sha256,
    nonce:intent.nonce,created_at:intent.created_at});
  let nova;
  try{nova=await novaService.reviewBidIntent(packet);}
  catch{return fail('nova_unavailable','nova');}
  // The actual deployed Nova preflight always responds with hold. Never
  // reinterpret that result as approval based on the user's broad instruction.
  if(nova?.decision!=='approve')return fail(nova?.decision==='hold'?'nova_governance_hold':'nova_no_approval','nova');
  if(!responseMatches('nova',nova,intent,canonical))return fail('nova_intent_binding_invalid','nova');
  try{if(await verifyNova(nova,canonical)!==true)return fail('nova_signature_invalid','nova');}
  catch{return fail('nova_signature_unavailable','nova');}
  let control;
  try{control=await operatorService.reviewBidIntent(packet);}
  catch{return fail('operator_unavailable','operator');}
  if(control?.decision!=='approve')return fail(control?.decision==='hold'?'operator_governance_hold':'operator_no_approval','operator');
  if(!responseMatches('chatgpt_operator',control,intent,canonical))return fail('operator_intent_binding_invalid','operator');
  try{if(await verifyOperator(control,canonical)!==true)return fail('operator_signature_invalid','operator');}
  catch{return fail('operator_signature_unavailable','operator');}
  const preflight=await councilBidPreflight({
    intent,nova,control,verifyNova,verifyControl:verifyOperator,readLedger,nowSec
  });
  if(preflight.state!=='preflight_passed_not_released')
    return fail(preflight.reason,'preflight');
  // Crucially: no 'can_submit:true' here. Only the separate atomic one-shot
  // reservation+market check can issue a scoped grant.
  return {state:'independent_reviews_verified',can_submit:false,
    may_release_governance_hold:false,ready_for_atomic_reservation:true,
    intent,canonical_intent:canonical,nova,control};
}
