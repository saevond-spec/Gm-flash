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
  intent,nova,control,verifyNova,verifyControl,readLedger,db,nowSec,
  independentFinalCheck
}) {
  if(!db||typeof db.batch!=='function'||typeof db.prepare!=='function')
    return deny('transactional_ledger_missing');
  if(typeof independentFinalCheck!=='function')return deny('fresh_market_check_missing');
  const initial=await councilBidPreflight({intent,nova,control,verifyNova,verifyControl,readLedger,nowSec});
  if(initial.state!=='preflight_passed_not_released')return deny(initial.reason);
  if(!ID.test(intent.problem_id)||!int(intent.amount_cents,500,2000)||!canonicalBidIntent(intent))
    return deny('invalid_intent');
  try {
    // Must verify live marketplace facts from a trusted GET source, not user JSON:
    // exact task id, open status, quote >= current floor, quote <= current USD budget,
    // non-simulated task, no prior bid, isolated delivery ready, no spending.
    const fresh=await independentFinalCheck(intent);
    if(fresh!==true)return deny('fresh_market_validation_failed');
    const intentHash=await digest(canonicalBidIntent(intent));
    const insertReservation=db.prepare(
      "INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) "+
      "SELECT 1878,?,?,'reserved' WHERE NOT EXISTS "+
      "(SELECT 1 FROM bid_reservations WHERE agent_id=1878 AND state IN ('reserved','uncertain')) "+
      "ON CONFLICT(agent_id,problem_id) DO NOTHING RETURNING problem_id"
    ).bind(intent.problem_id,intent.amount_cents);
    // This extra table has a UNIQUE nonce key and must be created by the scoped migration.
    const consumeNonce=db.prepare(
      "INSERT INTO sprite_council_nonce_consumption(nonce,agent_id,problem_id,amount_cents,intent_sha256) "+
      "VALUES(?,1878,?,?,?) RETURNING nonce"
    ).bind(intent.nonce,intent.problem_id,intent.amount_cents,intentHash);
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
      intent_sha256:intentHash,nonce:intent.nonce,requires_receipt_reconciliation:true};
  }catch {
    return deny('atomic_reservation_failed');
  }
}
