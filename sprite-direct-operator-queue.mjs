/**
 * Sprite #1878 — management-authorized one-shot direct bid queue.
 * DRAFT: do not deploy until exact v179 source reconciled and verified.
 * Authenticated Cloudflare D1 management writes only task ID + quote ceiling.
 * Never stores customer data, proposals, API keys, other-agent context.
 * Worker consumes via existing Sprite secrets and independent receipt checks.
 */
const validID=x=>typeof x==='string'&&/^[1-9]\d{0,9}$/.test(x);
const validQuote=x=>Number.isSafeInteger(x)&&x>=2000&&x<=100000;
const states=new Set(['confirmed','rejected','held','uncertain']);
const sqlGet="SELECT problem_id,amount_ceiling_cents,issued_at,expires_at FROM sprite_operator_bid_requests_v1 WHERE state='queued' AND agent_id=1878 ORDER BY issued_at ASC LIMIT 1";
const sqlClaim="UPDATE sprite_operator_bid_requests_v1 SET state='processing' WHERE problem_id=? AND agent_id=1878 AND state='queued' RETURNING problem_id,amount_ceiling_cents,issued_at,expires_at";
const sqlFinish="UPDATE sprite_operator_bid_requests_v1 SET state=?,result_code=? WHERE problem_id=? AND agent_id=1878 AND state='processing'";
export async function consumeSpriteOperatorBidQueue({db,nowSeconds=Math.floor(Date.now()/1000),submitSpriteDirectOnce}={}){
 if(!db||typeof db.prepare!=='function'||typeof submitSpriteDirectOnce!=='function')
  return {state:'unconfigured',attempted:false,confirmed:false};
 let peek;
 try{peek=await db.prepare(sqlGet).first();}
 catch{return {state:'queue_unavailable',attempted:false,confirmed:false};}
 if(!peek)return {state:'empty',attempted:false,confirmed:false};
 if(!validID(peek.problem_id)||!validQuote(peek.amount_ceiling_cents)||
    !Number.isSafeInteger(peek.issued_at)||!Number.isSafeInteger(peek.expires_at)||
    !Number.isSafeInteger(nowSeconds))
  return {state:'invalid_queue_request',attempted:false,confirmed:false};
 let claim;
 try{claim=await db.prepare(sqlClaim).bind(peek.problem_id).first();}
 catch{return {state:'claim_unavailable',attempted:false,confirmed:false};}
 if(!claim)return {state:'already_claimed',attempted:false,confirmed:false};
 const id=claim.problem_id;
 const finish=async(state,result_code)=>{
  if(!states.has(state))throw Error('invalid state');
  try{await db.prepare(sqlFinish).bind(state,result_code,id).run();return true}
  catch{return false}
 };
 if(claim.expires_at<=nowSeconds || claim.issued_at>nowSeconds ||
    claim.expires_at>claim.issued_at+86400){
  const saved=await finish('held','expired_or_future_request');
  return {state:saved?'operator_request_expired':'queue_status_write_failed',
    attempted:false,confirmed:false,problem_id:id};
 }
 let outcome;
 try{outcome=await submitSpriteDirectOnce({
   problem_id:id,delegated:true,nowMs:nowSeconds*1000,
   max_authorized_quote_cents:claim.amount_ceiling_cents
 });}
 catch{
   // Cannot distinguish failure before and after marketplace POST. No retry.
   const saved=await finish('uncertain','unexpected_execution_failure');
   return {state:saved?'uncertain_do_not_retry':'queue_status_write_failed',
     attempted:true,confirmed:false,problem_id:id};
 }
 const status=outcome?.state;
 const attempted=outcome?.attempted===true;
 let endState;
 if(status==='authenticated_bid_confirmed'&&outcome?.confirmed===true&&attempted)
  endState='confirmed';
 else if(attempted||String(status).includes('uncertain')||
         String(status).includes('receipt')||String(status).includes('send'))
  endState='uncertain';
 else if(status==='reservation_or_marketplace_rejected'||
         status==='existing_bid_requires_reconciliation')
  endState='rejected';
 else endState='held';
 const saved=await finish(endState,
  typeof status==='string'&&/^[a-z0-9_]{1,70}$/.test(status)?status:'unclassified');
 return {state:saved?endState:'queue_status_write_failed',attempted,
    confirmed:saved&&endState==='confirmed',problem_id:id,
    requires_marketplace_readback:!saved||endState==='uncertain'};
}
