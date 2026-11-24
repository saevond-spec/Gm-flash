import {exactBidReceipt} from "./bid-receipt.mjs";
// Sprite-only bid reservation guard. Never stores proposal text, customer data or credentials.
// A reservation is irrevocable from application code, even when transport outcome is unknown.
export async function submitWithReservation(db,problemId,amountCents,send){
 if(!db||typeof db.prepare!=="function")return {attempted:false,state:"ledger_unavailable",http_status:503};
 if(typeof problemId!=="string"||!/^[1-9]\d{0,9}$/.test(problemId)||!Number.isSafeInteger(amountCents)||amountCents<2000||amountCents>10000000||typeof send!=="function")return {attempted:false,state:"invalid_reservation",http_status:400};
 let row;
 try{
  row=await db.prepare("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,?,?,'reserved') ON CONFLICT(agent_id,problem_id) DO NOTHING RETURNING problem_id").bind(problemId,amountCents).first();
 }catch{return {attempted:false,state:"ledger_unavailable",http_status:503}}
 if(!row||row.problem_id!==problemId)return {attempted:false,state:"already_reserved_or_unconfirmed",http_status:409};
 // Persist SUBMITTING before crossing the network boundary. If the Worker crashes,
 // this state remains quarantined until authoritative reconciliation; never auto-retry.
 let started;
 try{started=await db.prepare("UPDATE bid_reservations SET state='submitting' WHERE agent_id=1878 AND problem_id=? AND amount_cents=? AND state='reserved' RETURNING problem_id").bind(problemId,amountCents).first();}
 catch{return {attempted:false,state:'pre_send_ledger_unavailable',http_status:503,requires_reconciliation:true}}
 if(started?.problem_id!==problemId)return {attempted:false,state:'reservation_not_ready',http_status:409,requires_reconciliation:true};
 let result;
 try{result=await send()}catch{result=null}
 const receipt=result?.ok===true&&Number.isInteger(result.status)&&result.status>=200&&result.status<300?exactBidReceipt(result.data,problemId,amountCents,{submissionContext:true}):null;
 if(receipt){try{await db.batch([db.prepare("INSERT INTO sprite_bid_receipts(problem_id,bid_id,amount_cents,source,observed_at) VALUES(?,?,?,'authenticated_submission',?) ON CONFLICT(problem_id) DO NOTHING").bind(problemId,receipt.bid_id,amountCents,new Date().toISOString()),db.prepare("UPDATE bid_reservations SET state='submitted' WHERE agent_id=1878 AND problem_id=? AND amount_cents=? AND state='submitting' AND EXISTS(SELECT 1 FROM sprite_bid_receipts WHERE problem_id=? AND bid_id=? AND amount_cents=?)").bind(problemId,amountCents,problemId,receipt.bid_id,amountCents)]);const saved=await db.prepare("SELECT state FROM bid_reservations WHERE agent_id=1878 AND problem_id=?").bind(problemId).first();if(saved?.state==="submitted")return {attempted:true,state:"submitted",http_status:200,upstream_status:result.status,transport_ok:true,bid_id:receipt.bid_id,requires_reconciliation:false};}catch{}}
 // HTTP success alone is not proof of an accepted bid; require later independent reconciliation.
 try{
  await db.prepare("UPDATE bid_reservations SET state='uncertain' WHERE agent_id=1878 AND problem_id=? AND state='submitting'").bind(problemId).run();
 }catch{/* Original reservation still blocks further sends. */}
 return {attempted:true,state:"uncertain",http_status:502,upstream_status:Number.isInteger(result?.status)?result.status:null,transport_ok:result?.ok===true,requires_reconciliation:true};
}
