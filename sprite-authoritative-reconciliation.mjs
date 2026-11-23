// Sprite-only authoritative receipt reconciliation.
// NO marketplace POST, retry, nonce clearing, or negative inference from missing data.
// Caller must supply a PRIVATE trusted collector, trusted independently authenticated
// receipt verifier, and the existing Sprite-only D1 ledger. Never expose callbacks
// through HTTP or trust 'verified:true' from a customer/task response.
const ID=/^[1-9][0-9]{0,9}$/;
const BID=/^[A-Za-z0-9][A-Za-z0-9:_-]{3,127}$/;
const TYPES=new Set(['authenticated_bid_record','authenticated_market_outcomes']);
const integer=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
const hold=(reason,extra={})=>({state:'unresolved',reason,confirmed:false,may_resubmit:false,receipt_written:false,...extra});
function normalizeRecord(record,expected){
  if(!record||typeof record!=='object'||Array.isArray(record))return null;
  const b=record.bid??record;
  if(!b||typeof b!=='object'||Array.isArray(b))return null;
  const bid_id=b.bid_id;
  if(!BID.test(bid_id)||String(b.problem_id??'')!==expected.problemId
     ||b.agent_id!==1878||b.amount_cents!==expected.amountCents)return null;
  return {bid_id,problem_id:expected.problemId,agent_id:1878,amount_cents:expected.amountCents};
}
export function classifySpriteReceiptEvidence({problemId,amountCents,records,coverageComplete=false}={}){
  if(!ID.test(problemId)||!integer(amountCents,500,2000)||!Array.isArray(records)||records.length>100)
    return hold('invalid_receipt_inputs');
  if(!records.length)return hold('no_authoritative_receipt_candidates',{coverage_complete:coverageComplete===true});
  const valid=new Set();let contradictions=0,weak=0;
  for(const row of records){
    // Only candidate records whose source was independently verified should be
    // passed by the collector. Weak or conflicting records cannot be confirmed.
    if(!row||!TYPES.has(row.source_type)||row.authenticated!==true) {weak++;continue;}
    const matched=normalizeRecord(row,{problemId,amountCents});
    if(matched)valid.add(matched.bid_id);
    else contradictions++;
  }
  if(contradictions>0)return hold('contradictory_authoritative_record');
  if(valid.size>1)return hold('multiple_conflicting_bid_ids');
  if(weak>0)return hold('mixed_weak_and_authoritative_evidence');
  if(valid.size!==1)return hold('no_exact_authoritative_receipt_match');
  return {state:'exact_receipt_candidate',confirmed:false,may_resubmit:false,
    receipt_written:false,bid_id:[...valid][0],problem_id:problemId,amount_cents:amountCents,
    requires_trusted_crypto_or_private_source_verification:true};
}

export async function reconcileSpriteUncertainBid({
  db,problemId,amountCents,collectAuthoritativeRecords,verifyExactReceipt,
  observedAt
}={}){
  if(!db||typeof db.batch!=='function'||typeof db.prepare!=='function')
    return hold('transactional_ledger_unavailable');
  if(typeof collectAuthoritativeRecords!=='function'||typeof verifyExactReceipt!=='function')
    return hold('independent_collector_or_verifier_missing');
  if(!ID.test(problemId)||!integer(amountCents,500,2000)||
    typeof observedAt!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(observedAt))
    return hold('invalid_exact_reservation');
  let current;
  try{current=await db.prepare(
    "SELECT problem_id,amount_cents,state FROM bid_reservations WHERE agent_id=1878 AND problem_id=?"
  ).bind(problemId).first();}
  catch{return hold('ledger_read_failure');}
  if(!current||current.state!=='uncertain'||current.amount_cents!==amountCents)
    return hold('reservation_not_exactly_uncertain');
  let result;
  try{result=await collectAuthoritativeRecords({problem_id:problemId,amount_cents:amountCents,agent_id:1878});}
  catch{return hold('authoritative_marketplace_unavailable');}
  if(!result||result.source!=='authenticated_private_marketplace_collector'
     ||result.identity_verified!==true||!Array.isArray(result.records))
    return hold('marketplace_collector_provenance_missing');
  const cls=classifySpriteReceiptEvidence({problemId,amountCents,records:result.records,coverageComplete:result.coverage_complete});
  if(cls.state!=='exact_receipt_candidate')return cls;
  try{
    // verifyExactReceipt must perform independent official-source verification.
    // The untrusted JSON attributes alone are not proof of authenticity.
    if(await verifyExactReceipt({problem_id:problemId,amount_cents:amountCents,
      bid_id:cls.bid_id,agent_id:1878})!==true)return hold('receipt_authenticity_not_verified');
  }catch{return hold('receipt_verifier_unavailable');}
  try{
    const [mark,save]=await db.batch([
      db.prepare("UPDATE bid_reservations SET state='submitted' WHERE agent_id=1878 AND problem_id=? AND amount_cents=? AND state='uncertain' RETURNING problem_id").bind(problemId,amountCents),
      db.prepare(
        "INSERT INTO sprite_bid_receipts(problem_id,bid_id,amount_cents,source,observed_at) "+
        "SELECT ?,?,?,?,? WHERE changes()=1 RETURNING problem_id"
      ).bind(problemId,cls.bid_id,amountCents,'authenticated_private_marketplace_collector',observedAt)
    ]);
    // A conflicting pre-existing receipt raises a UNIQUE violation, forcing
    // D1 batch rollback of the first update. Never silently ignore conflicts.
    if(mark?.results?.length!==1||save?.results?.length!==1)
      return hold('receipt_transaction_not_confirmed');
    return {state:'confirmed_submitted',reason:null,confirmed:true,
      may_resubmit:false,receipt_written:true,problem_id:problemId,bid_id:cls.bid_id};
  }catch{return hold('receipt_transaction_failed');}
}
