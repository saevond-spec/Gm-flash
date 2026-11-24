// Readiness-to-network boundary for Sprite. This is an integration adapter, not an auto-activation.
// Caller must provide a trusted, persisted authorization verifier and crash-safe D1 reservation adapter.
// Import this module only after production and staging contracts agree.
import {validateBidPackage,classifyBidReceipt} from './clawhunt-marketplace-v3.mjs';
const apiOrigin='https://clawhunt.store';
const fail=(state,detail)=>({state,attempted:false,confirmed:false,detail});
async function readBoundedJson(response,maxBytes=32768) {
  if (!response.body || typeof response.body.getReader!=='function') return null;
  const reader=response.body.getReader(),dec=new TextDecoder(),parts=[];let size=0;
  try {
    for (;;) {
      const x=await reader.read();if(x.done)break;
      size+=x.value.byteLength;
      if(size>maxBytes) throw Error('oversize_marketplace_response');
      parts.push(dec.decode(x.value,{stream:true}));
    }
    parts.push(dec.decode());
  } finally {try{await reader.cancel()}catch{}}
  try{return JSON.parse(parts.join(''))}catch{return null}
}
export async function submitAuthorizedBid({env,intent,bounds,verifyApproval,ledger,fetchImpl=fetch,timeoutMs=12000}) {
  if (!env?.CPH_API_KEY || !/^cph_/.test(env.CPH_API_KEY)) return fail('identity_unavailable','missing_api_key');
  if (typeof verifyApproval!=='function'||!ledger||typeof ledger.reserve!=='function'||typeof ledger.markSubmitting!=='function'||typeof ledger.confirm!=='function'||typeof ledger.unknown!=='function') return fail('authorization_unavailable','missing_trusted_adapters');
  let body;try{body=validateBidPackage(intent,bounds)}catch(e){return fail('preflight_denied',e.code||'invalid_bid')}
  // The authoritative review must bind the FULL payload, not only amount and message.
  let verified=false;
  try{verified=await verifyApproval({intent,bounds,body})===true}catch{}
  if (!verified) return fail('approval_denied','invalid_or_expired_signed_intent');
  const problemId=String(intent.problem_id);
  let reservation;
  try {reservation=await ledger.reserve({problem_id:problemId,amount_cents:body.amount,intent});}
  catch {return fail('reservation_unavailable','atomic_reservation_failed')}
  if (!reservation?.ok || !reservation.id) return fail('duplicate_or_reservation_hold','no_new_reservation');
  // State must be durable BEFORE attempting outbound I/O.
  try {
    const state=await ledger.markSubmitting({reservation_id:reservation.id,problem_id:problemId});
    if (state!==true) return fail('submission_not_started','transition_denied');
  } catch {return fail('submission_not_started','transition_failed')}
  let response=null,payload=null,networkAttempted=false,errorCode='transport_unknown',httpStatus=null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    networkAttempted=true;
    response=await fetchImpl(apiOrigin+'/api/v1/problems/'+encodeURIComponent(problemId)+'/bid',{
      method:'POST',redirect:'manual',signal:controller.signal,
      headers:{Authorization:'Bearer '+env.CPH_API_KEY,Accept:'application/json','Content-Type':'application/json','User-Agent':'Sprite-v3/contract-verified'},
      body:JSON.stringify(body)
    });
    httpStatus=response.status;
    if (response.status>=300 && response.status<400) errorCode='redirect_denied';
    else {
      payload=await readBoundedJson(response);
      errorCode=response.ok?'receipt_unverified':'marketplace_rejected_or_unknown';
    }
  } catch(e) {errorCode=e?.name==='AbortError'?'timeout_unknown':'network_unknown'}
  finally{clearTimeout(timer)}
  const match=payload&&response?.ok?classifyBidReceipt(payload,{problem_id:problemId,agent_id:1878,amount_cents:body.amount}):{confirmed:false};
  if (match.confirmed) {
    try {
      const result=await ledger.confirm({reservation_id:reservation.id,receipt:match,http_status:httpStatus});
      if (result===true) return {state:'CONFIRMED',attempted:networkAttempted,confirmed:true,bid_id:match.bid_id,http_status:httpStatus};
    } catch{}
    errorCode='receipt_persistence_unknown';
  }
  try{await ledger.unknown({reservation_id:reservation.id,reason:errorCode,http_status:httpStatus})}catch{}
  return {state:'UNKNOWN',attempted:networkAttempted,confirmed:false,http_status:httpStatus,requires_read_only_reconciliation:true,reason:errorCode};
}
