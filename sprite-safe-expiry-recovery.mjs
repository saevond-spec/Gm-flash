// Sprite-only, recovery of an EXPIRED, NEVER-CLAIMED reservation.
// A claim transitions 'reserved' -> 'uncertain' BEFORE any network request.
// Never cancel an 'uncertain' reservation here; unknown transport must be
// independently reconciled against authoritative marketplace records.
// The historical #3298 hold is not eligible for cancellation.
const ID=/^[1-9][0-9]{0,9}$/;
const HASH=/^[0-9a-f]{64}$/;
const NONCE=/^[0-9a-f]{32,64}$/;
const valid=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const hold=reason=>({state:'hold',reason,released:false,may_submit:false});

export async function releaseExpiredNeverSentSpriteReservation({
 db,problemId,nonce,intentSha256,nowSec
}={}){
 if(!db||typeof db.prepare!=='function')return hold('trusted_db_missing');
 if(!ID.test(problemId)||problemId==='3298'||!NONCE.test(nonce)
    ||!HASH.test(intentSha256)||!valid(nowSec,1,Number.MAX_SAFE_INTEGER))
   return hold('invalid_exact_reservation');
 try{
  // The decision is made BY D1's current row and the originally persisted
  // expires_at_sec; the caller cannot extend, override or omit expiry.
  // No delete; the consumed nonce remains permanently consumed, and
  // agent+task uniqueness prevents re-bidding this same task blindly.
  const row=await db.prepare(
   "UPDATE bid_reservations SET state='rejected' "+
   "WHERE agent_id=1878 AND problem_id=? AND state='reserved' "+
   "AND EXISTS (SELECT 1 FROM sprite_council_nonce_consumption "+
   "WHERE nonce=? AND agent_id=1878 AND problem_id=? AND "+
   "intent_sha256=? AND amount_cents=bid_reservations.amount_cents "+
   "AND expires_at_sec<=?) RETURNING problem_id"
  ).bind(problemId,nonce,problemId,intentSha256,nowSec).first();
  if(row?.problem_id!==problemId)return hold('not_expired_or_not_never_sent');
  return {state:'expired_never_sent_cancelled',released:true,may_submit:false,
   problem_id:problemId,nonce_still_consumed:true};
 }catch{
  return hold('transactional_release_failed');
 }
}
