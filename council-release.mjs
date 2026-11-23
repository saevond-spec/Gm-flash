// Sprite-only approval release adapter; not installed in the production Worker.
// Contract: trusted Nova and operator-side signature verifiers, a verified bid intent,
// a D1 ledger with migration applied, and a final marketplace recheck.
// Security model: D1 batch is atomic; conflict/replay rolls back before send.
import {canonicalBidIntent,councilBidPreflight} from './council-preflight.mjs';

const ID=/^[1-9]\d{0,9}$/;
const int=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const deny=(reason)=>({state:'hold',reason,can_submit:false,reserved:false});
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}

export async function authorizeAndReserveBid({
  intent,mother,nova,control,verifyMother,verifyNova,verifyControl,readLedger,db,nowSec,
  independentFinalCheck
}) {
  if(!db||typeof db.batch!=='function'||typeof db.prepare!=='function')
    return deny('transactional_ledger_missing');
  if(typeof independentFinalCheck!=='function')return deny('fresh_market_check_missing');
  const initial=await councilBidPreflight({intent,mother,nova,control,verifyMother,verifyNova,verifyControl,readLedger,nowSec});
  if(initial.state!=='preflight_passed_not_released')return deny(initial.reason);
  if(!ID.test(intent.problem_id)||intent.problem_id==='3298'||!int(intent.amount_cents,500,2000)||!canonicalBidIntent(intent))
    return deny('invalid_intent');
  try {
    // Must verify live marketplace facts from a trusted GET source, not user JSON:
    // exact task id, open status, quote >= current floor, quote <= current USD budget,
    // non-simulated task, no prior bid, isolated delivery ready, no spending.
    const fresh=await independentFinalCheck(intent);
    if(fresh!==true)return deny('fresh_market_validation_failed');
    const intentHash=await digest(canonicalBidIntent(intent));
    const validUntil=Math.min(nova.expires_at,control.expires_at,intent.created_at+900);
    const insertReservation=db.prepare(
      "INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) "+
      "SELECT 1878,?,?,'reserved' WHERE NOT EXISTS "+
      // Legacy #3298 stays reserved forever until a separately verified receipt is found.
      // Only one NEW bid may have an uncertain transport result at a time.
      "(SELECT 1 FROM bid_reservations WHERE agent_id=1878 AND problem_id<>'3298' AND state IN ('reserved','uncertain')) "+
      "ON CONFLICT(agent_id,problem_id) DO NOTHING RETURNING problem_id"
    ).bind(intent.problem_id,intent.amount_cents);
    // This extra table has a UNIQUE nonce key and must be created by the scoped migration.
    const consumeNonce=db.prepare(
      "INSERT INTO sprite_council_nonce_consumption(nonce,agent_id,problem_id,amount_cents,intent_sha256,proposal_sha256,expires_at_sec) "+
      // `changes()` is from the immediately previous INSERT in the D1 transaction.
      // Prevents consuming a nonce if no reservation was actually inserted.
      "SELECT ?,1878,?,?,?,?,? WHERE changes()=1 RETURNING nonce"
    ).bind(intent.nonce,intent.problem_id,intent.amount_cents,intentHash,intent.proposal_sha256,validUntil);
    const results=await db.batch([insertReservation,consumeNonce]);
    if(!Array.isArray(results)||results.length!==2)return deny('transaction_result_unavailable');
    const reservation=results[0]?.results??[];
    const consumption=results[1]?.results??[];
    if(reservation.length!==1||reservation[0]?.problem_id!==intent.problem_id
      ||consumption.length!==1||consumption[0]?.nonce!==intent.nonce)
      return deny('reservation_or_nonce_not_acquired');
    // Permission to send is temporary and only for the exact canonical intent.
    // Caller must submit ONCE with existing reservation, never call a second reserve.
    return {state:'reserved_for_one_submission',can_submit:true,reserved:true,
      agent_id:1878,problem_id:intent.problem_id,amount_cents:intent.amount_cents,
      intent_sha256:intentHash,proposal_sha256:intent.proposal_sha256,nonce:intent.nonce,
      valid_until_sec:validUntil,requires_receipt_reconciliation:true};
  }catch {
    return deny('atomic_reservation_failed');
  }
}


// At-most-once transport gate. Runs only in a trusted Sprite-only submission
// component and never accepts a sender callback from a public HTTP request.
// State is set to uncertain BEFORE network I/O: worker crash cannot cause retry.
export async function sendReservedBidOnce({db, grant, send, proposalText, nowSec, trustedNowSec}) {
  const stop=reason=>({attempted:false,state:reason,confirmed:false});
  if(!db||typeof db.prepare!=='function'||typeof send!=='function')return stop('trusted_transport_unavailable');
  if(typeof trustedNowSec!=='function')return stop('trusted_clock_unavailable');
  if(!grant||grant.state!=='reserved_for_one_submission'||grant.agent_id!==1878
    ||!ID.test(grant.problem_id)||grant.problem_id==='3298'
    ||!int(grant.amount_cents,500,2000)
    ||!int(grant.valid_until_sec,1,Number.MAX_SAFE_INTEGER)
    ||typeof grant.intent_sha256!=='string'||!/^[0-9a-f]{64}$/.test(grant.intent_sha256)
    ||typeof grant.proposal_sha256!=='string'||!/^[0-9a-f]{64}$/.test(grant.proposal_sha256)
    ||typeof grant.nonce!=='string'||!/^[0-9a-f]{32,64}$/.test(grant.nonce))
    return stop('reservation_grant_invalid');
  // Production passes its own trusted clock, never a time from the incoming request.
  if(!int(nowSec,1,Number.MAX_SAFE_INTEGER)||nowSec>=grant.valid_until_sec)
    return stop('approval_expired_before_send');
  // Never submit a proposal different from the exact message the two reviewers approved.
  if(typeof proposalText!=='string'||proposalText.length<10||proposalText.length>1000)
    return stop('proposal_missing_or_out_of_bounds');
  try{if(await digest(proposalText)!==grant.proposal_sha256)return stop('proposal_hash_mismatch');}
  catch{return stop('proposal_hash_unavailable');}
  let claim;
  try{
    claim=await db.prepare(
      "UPDATE bid_reservations SET state='uncertain' "+
      "WHERE agent_id=1878 AND problem_id=? AND amount_cents=? AND state='reserved' "+
      "AND EXISTS (SELECT 1 FROM sprite_council_nonce_consumption "+
      "WHERE nonce=? AND agent_id=1878 AND problem_id=? AND amount_cents=? AND intent_sha256=? "+
      "AND proposal_sha256=? AND expires_at_sec=? AND expires_at_sec>?) "+
      "RETURNING problem_id"
    ).bind(grant.problem_id,grant.amount_cents,grant.nonce,grant.problem_id,grant.amount_cents,grant.intent_sha256,grant.proposal_sha256,grant.valid_until_sec,nowSec).first();
  }catch{return stop('reservation_claim_unavailable');}
  if(claim?.problem_id!==grant.problem_id)return stop('reservation_already_claimed_or_mismatched');
  // A D1 write can be delayed: re-check approval after the reservation claim,
  // immediately before touching the marketplace. Hold rather than send if expired.
  // The uncertain reservation is deliberately retained for operator reconciliation.
  let rechecked;
  try{rechecked=await trustedNowSec();}
  catch{return {attempted:false,state:'claimed_but_clock_unavailable',confirmed:false,requires_reconciliation:true};}
  if(!int(rechecked,nowSec,Number.MAX_SAFE_INTEGER)||rechecked>=grant.valid_until_sec)
    return {attempted:false,state:'claimed_but_approval_expired',confirmed:false,requires_reconciliation:true};
  let upstream=null;
  try{
    // At most one call. No retries and no implicit receipt acceptance.
    upstream=await send({problem_id:grant.problem_id,amount_cents:grant.amount_cents,message:proposalText});
  }catch{}
  return {attempted:true,state:'uncertain',confirmed:false,requires_reconciliation:true,
    problem_id:grant.problem_id,amount_cents:grant.amount_cents,
    upstream_status:Number.isInteger(upstream?.status)?upstream.status:null};
}
