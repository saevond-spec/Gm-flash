/**
 * Sprite #1878 — authentic-marketplace evidence review (PUBLIC task metadata).
 * Pure / no network requests, customer material, storage, model calls,
 * cross-project binding use, or marketplace bid side effects.
 *
 * A returned "reviewable" job is NOT bid-authorized, paid, or deliverable.
 * Detailed scope review occurs AFTER a verified award, in a customer sandbox.
 */
const ID=/^[1-9][0-9]{0,9}$/;
const isCents=n=>Number.isSafeInteger(n)&&n>0&&n<=10000000;
const normalized=x=>typeof x==='string'?x.trim().toLowerCase():'';
const taskId=x=>{
  const v=x?.problem_id??x?.id;
  const result=typeof v==='number'&&Number.isSafeInteger(v)?String(v):typeof v==='string'?v:'';
  return ID.test(result)?result:null;
};
const yes=x=>x===true||x===1;
const no=x=>x===false||x===0;
const apparentSimulation=t=>yes(t?.is_simulated)||yes(t?.simulated)||
  yes(t?.is_simulation)||normalized(t?.bounty_type)==='simulated'||
  t?.review_mode==='simulation' || t?.review_mode==='simulated';
const explicitReal=t=>no(t?.is_simulated)||no(t?.simulated)||
  no(t?.is_simulation);
const stamped=x=>{
  const ms=Date.parse(typeof x==='string'?x:'');
  return Number.isFinite(ms)?ms:null;
};
export function assessPublicTaskAuthenticity({inventory,authenticatedTask,publicPage,nowMs=Date.now(),maxAgeMs=900000,quoteCents=null}={}){
  const reasons=[];
  const result=(state)=>({
    state,reviewable:state==='funded_reported_reviewable'||state==='no_escrow_reviewable',
    bid_authorized:false,requires_fresh_prebid_detail:true,
    detailed_scope_review_stage:'post_award',
    escrow_guaranteed:false,simulated_proved_false:state==='funded_reported_reviewable'||state==='no_escrow_reviewable',
    funding_kind:state==='no_escrow_reviewable'?'unfunded_no_escrow':
      state==='funded_reported_reviewable'?'reported_funded_unconfirmed':null,
    reasons:[...new Set(reasons)]
  });
  if(!Number.isFinite(nowMs)||nowMs<=0||!Number.isFinite(maxAgeMs)||maxAgeMs<1000||maxAgeMs>3600000){
    reasons.push('invalid_evidence_clock');return result('invalid');
  }
  const id=taskId(inventory),detailId=taskId(authenticatedTask);
  if(!id||!detailId||id!==detailId){reasons.push('authenticated_task_identity_missing_or_mismatch');return result('invalid');}
  if(apparentSimulation(inventory)||apparentSimulation(authenticatedTask)){
    reasons.push('explicit_simulation_flag');return result('simulated');
  }
  if(publicPage?.simulated_bounty_banner===true){
    reasons.push('public_marketplace_simulation_warning');return result('evidence_conflict');
  }
  const seen=stamped(authenticatedTask?.fetched_at);
  if(seen===null||seen>nowMs||nowMs-seen>maxAgeMs||authenticatedTask?.authenticated!==true){
    reasons.push('authenticated_task_detail_stale_or_missing');return result('needs_fresh_authoritative_detail');
  }
  if(!explicitReal(authenticatedTask)){
    reasons.push('simulation_status_not_explicitly_verified');return result('simulation_unknown');
  }
  if(!['open','bidding'].includes(normalized(authenticatedTask.status))){
    reasons.push('marketplace_task_not_biddable');return result('not_biddable');
  }
  if(normalized(authenticatedTask.currency)!=='usd'){
    reasons.push('marketplace_currency_not_usd');return result('price_unverified');
  }
  if(inventory?.budget_cents!=null && !Number.isSafeInteger(inventory.budget_cents)){
    reasons.push('bad_cached_budget');return result('price_unverified');
  }
  const escrow=normalized(authenticatedTask.escrow_status);
  let budget=null,floor=null;
  if(['funded','held'].includes(escrow)){
    if(authenticatedTask.escrow_funded===false||authenticatedTask.payment_evidence==='no_payment_recorded'){
      reasons.push('contradictory_funding_state');return result('evidence_conflict');
    }
    if(!isCents(authenticatedTask.price)||
       authenticatedTask.reference_price!=null&&authenticatedTask.reference_price!==authenticatedTask.price||
       authenticatedTask.escrow_amount!=null&&authenticatedTask.escrow_amount!==authenticatedTask.price){
      reasons.push('funded_price_fields_conflict');return result('price_unverified');
    }
    budget=authenticatedTask.price;
  }else if(['none','unfunded'].includes(escrow)){
    if(authenticatedTask.escrow_funded===true||authenticatedTask.payment_evidence==='funded_escrow'){
      reasons.push('contradictory_no_escrow_state');return result('evidence_conflict');
    }
    if(!isCents(authenticatedTask.reference_price)||
       authenticatedTask.price!=null&&authenticatedTask.price!==0||
       authenticatedTask.escrow_amount!=null&&authenticatedTask.escrow_amount!==0){
      reasons.push('no_escrow_reference_price_unverified');return result('price_unverified');
    }
    budget=authenticatedTask.reference_price;
  }else{
    reasons.push('unknown_escrow_status');return result('funding_unknown');
  }
  if(isCents(authenticatedTask.price)&&authenticatedTask.price_credits!=null&&
     authenticatedTask.price!==authenticatedTask.price_credits*100){
    reasons.push('price_unit_conflict');return result('price_unverified');
  }
  if(isCents(authenticatedTask.reference_price)&&authenticatedTask.reference_price_credits!=null&&
     authenticatedTask.reference_price!==authenticatedTask.reference_price_credits*100){
    reasons.push('reference_price_unit_conflict');return result('price_unverified');
  }
  floor=Math.min(budget,Math.max(100,Math.ceil(budget*0.05)));
  if(quoteCents!==null && (!Number.isSafeInteger(quoteCents)||
    quoteCents<2000||quoteCents>100000||quoteCents<floor||quoteCents>budget)){
    reasons.push('quote_outside_live_executable_bounds');return result('price_unverified');
  }
  // A "reported-funded" job still requires escrow settlement and truthful
  // deliverability. No-escrow is an allowed bid choice, not payment assurance.
  return result(['none','unfunded'].includes(escrow)?'no_escrow_reviewable':'funded_reported_reviewable');
}
