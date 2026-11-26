
/**
 * Sprite-only scoped direct batch operator. No buyer files, code, attachments,
 * private customer data, model prompts or other project credentials persisted.
 * D1 contains only numeric task IDs, ceilings, and immutable send states.
 * One authenticated POST per ID maximum; uncertain outcome NEVER retries.
 */
async function spriteDirectScopedBatch(env,minute){
 const db=env.BID_LEDGER;
 if(!db||!env.CPH_API_KEY||SPRITE_SLEEP_MODE||minute%5===0)return;
 for(let n=0;n<2;n++){
  let row;
  try{row=await db.prepare("UPDATE sprite_operator_bid_requests_v1 SET state='processing' WHERE agent_id=1878 AND state='queued' AND problem_id=(SELECT problem_id FROM sprite_operator_bid_requests_v1 WHERE agent_id=1878 AND state='queued' AND problem_id<>'4188' ORDER BY amount_ceiling_cents DESC,issued_at ASC LIMIT 1) RETURNING problem_id,amount_ceiling_cents,issued_at,expires_at").first();}
  catch{return;}
  if(!row)return;
  const id=row.problem_id,amount=row.amount_ceiling_cents,now=Math.floor(Date.now()/1000);
  const finish=async(state,code)=>{
   try{await db.prepare("UPDATE sprite_operator_bid_requests_v1 SET state=?,result_code=? WHERE agent_id=1878 AND problem_id=? AND state='processing'").bind(state,code,id).run();}
   catch{}
  };
  if(!Object.hasOwn(BATCH_TASKS,id)){await finish('held','not_explicit_operator_scope');continue;}
  if(!Number.isSafeInteger(amount)||amount<2000||amount>100000||
    !Number.isSafeInteger(row.issued_at)||!Number.isSafeInteger(row.expires_at)||
    row.issued_at>now||row.expires_at<=now||row.expires_at>row.issued_at+86400){
   await finish('held','operator_authorization_expired_or_invalid');continue;
  }
  try{
   const existing=await db.prepare("SELECT 1 hit FROM bid_reservations WHERE agent_id=1878 AND problem_id=? UNION SELECT 1 FROM sprite_bid_receipts WHERE problem_id=? UNION SELECT 1 FROM sprite_authenticated_presence_v1 WHERE agent_id=1878 AND problem_id=? UNION SELECT 1 FROM sprite_bid_provisional_v1 WHERE problem_id=? LIMIT 1").bind(id,id,id,id).first();
   if(existing){await finish('rejected','existing_bid_or_uncertain_send');continue;}
   const agent=await spriteMetadata(env);
   if(Number(agent?.id??agent?.agent_id)!==1878||agent?.admission_status!=='approved'||agent?.webhook_url!==EXPECTED_HOOK){
    await finish('held','sprite_identity_unverified');continue;
   }
   const task=await autoRequest(env,id);
   const bounds=verifiedMarketBounds(task);
   const q=qualifyTask(task,id,amount);
   if(!q.eligible||!bounds.ok||bounds.budget_cents<amount||task?.bounty_type!=='escrowed'||
     !['funded','held'].includes(String(task?.escrow_status??'').toLowerCase())||
     task?.escrow_funded===false||task?.payment_evidence==='no_payment_recorded'||
     (task?.escrow_amount!=null&&task.escrow_amount!==task?.price)||
     task?.simulated===true||task?.simulated===1||task?.is_simulated===true||task?.is_simulated===1||
     String(task?.status??'').toLowerCase()!=='bidding'){
    await finish('held','live_task_or_funding_unverified');continue;
   }
   const copy=buildSpriteScopedBidCopy(task,amount);
   const payload=buildClawHuntBidRequest({problem_id:id,agent_id:1878,
     amount_cents:amount,buyer_message:copy.message,proposal_text:copy.proposal_text,
     estimated_time:copy.estimated_time,scope_details:copy.scope_details},bounds);
   const frozen=canonicalSignedClawHuntPayload(payload);
   const result=await reserveThenScan(submitWithReservation,
    taskId=>spritePostBidScan(env,taskId),db,id,amount,
    ()=>autoRequest(env,id,amount,frozen,{operatorDelegated:true,bidPayload:payload}));
   if(result?.state==='submitted'&&result?.bid_id){
    await finish('confirmed','authenticated_bid_confirmed');
   }else if(result?.attempted===true||result?.state==='uncertain'){
    await finish('uncertain','sent_or_receipt_unverified');
   }else if(['already_reserved_or_unconfirmed','unresolved_reservation_cap_hold'].includes(result?.state)){
    await finish('rejected','reservation_or_capacity_hold');
   }else{
    await finish('held','direct_send_not_attempted');
   }
  }catch{
   let reserved=null;
   try{reserved=await db.prepare("SELECT 1 hit FROM bid_reservations WHERE agent_id=1878 AND problem_id=?").bind(id).first();}
   catch{}
   await finish(reserved?'uncertain':'held',reserved?'send_exception_reconcile':'preflight_exception_no_send');
  }
 }
}
