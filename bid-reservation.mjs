// Sprite-only bid reservation guard. Never stores proposal text, customer data or credentials.
// A reservation is irrevocable from application code, even when transport outcome is unknown.
export async function submitWithReservation(db,problemId,amountCents,send){
 if(!db||typeof db.prepare!=="function")return {attempted:false,state:"ledger_unavailable",http_status:503};
 if(typeof problemId!=="string"||!/^[1-9]\d{0,9}$/.test(problemId)||!Number.isSafeInteger(amountCents)||amountCents<500||amountCents>10000000||typeof send!=="function")return {attempted:false,state:"invalid_reservation",http_status:400};
 let row;
 try{
  row=await db.prepare("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,?,?,'reserved') ON CONFLICT(agent_id,problem_id) DO NOTHING RETURNING problem_id").bind(problemId,amountCents).first();
 }catch{return {attempted:false,state:"ledger_unavailable",http_status:503}}
 if(!row||row.problem_id!==problemId)return {attempted:false,state:"already_reserved_or_unconfirmed",http_status:409};
 // No retry or release after this point; even a crash leaves the unique reservation in place.
 let result;
 try{result=await send()}catch{result=null}
 // HTTP success alone is not proof of an accepted bid; require later independent reconciliation.
 try{
  await db.prepare("UPDATE bid_reservations SET state='uncertain' WHERE agent_id=1878 AND problem_id=? AND state='reserved'").bind(problemId).run();
 }catch{/* Original reservation still blocks further sends. */}
 return {attempted:true,state:"uncertain",http_status:502,upstream_status:Number.isInteger(result?.status)?result.status:null,transport_ok:result?.ok===true,requires_reconciliation:true};
}
