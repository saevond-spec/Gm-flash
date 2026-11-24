// Read-only safe adaptations of the uploaded sprite_repair.mjs.
export const SPRITE_REPAIR_SAFE_VERSION='sprite-repair-safe-v159';
const pid=x=>(typeof x==='string'||Number.isSafeInteger(x))?String(x):'';
const hold=(state,extra={})=>({state,confirmed:false,may_proceed:false,may_resubmit:false,release_reservation:false,...extra});
const allowedStatus=new Set(['pending','submitted','active','selected','not_selected','closed','rejected','withdrawn','lost','won','placed']);
export function strictReceipt3298(records,{originAuthenticated=false,agentId=1878}={}){
 if(!originAuthenticated||agentId!==1878||!Array.isArray(records)||records.length>200)return hold('UNTRUSTED_SOURCE');
 const matching=new Map();
 for(const r of records){if(!r||typeof r!=='object'||Array.isArray(r))return hold('INVALID_RECORD');
  if(pid(r.problem_id??r.problem?.id??r.task_id??r.job_id)!=='3298')continue;
  if(r.agent_id!=null&&pid(r.agent_id)!=='1878')return hold('WRONG_AGENT');
  const id=pid(r.bid_id);if(!/^[1-9][0-9]{0,12}$/.test(id))return hold('INVALID_BID_ID');
  const status=String(r.status??r.outcome??'').toLowerCase();if(!allowedStatus.has(status))return hold('INVALID_STATUS');
  const amount=r.amount_cents??null;
  if(matching.has(id)){const prev=matching.get(id);if(prev!=null&&amount!=null&&prev!==amount)return hold('CONFLICT');matching.set(id,prev??amount);}else matching.set(id,amount);
 }
 if(matching.size===0)return hold('INCONCLUSIVE');
 if(matching.size>1)return hold('MULTIPLE_BIDS');
 if(!matching.has('32672'))return hold('UNEXPECTED_BID_ID');
 const cents=matching.get('32672');
 if(cents==null)return hold('BID_PRESENT_AMOUNT_UNKNOWN',{bid_id:'32672'});
 if(!Number.isSafeInteger(cents)||cents<1)return hold('INVALID_AMOUNT');
 if(cents!==650)return hold('AMOUNT_CONFLICT',{bid_id:'32672'});
 return hold('AMOUNT_MATCHED_PARTIAL_COVERAGE',{bid_id:'32672',amount_verified_in_observed_record:true});
}
export function parseVerifiedBudget(job){
 if(!job||typeof job!=='object')return{ok:false,reason:'missing_job'};
 if(job.currency!=='USD')return{ok:false,reason:'currency_not_authoritatively_usd'};
 const cents=job.budget_cents??job.budget?.cents;
 if(!Number.isSafeInteger(cents)||cents<1||cents>10000000)return{ok:false,reason:'budget_cents_unverified'};
 if(job.budget_cents!=null&&job.budget?.cents!=null&&job.budget_cents!==job.budget.cents)return{ok:false,reason:'budget_conflict'};
 return{ok:true,budget_cents:cents,currency:'USD'};
}
export function classifyReceiptException(error,stage){const valid=new Set(['start','identity','http','read','parse','reconcile','complete']);const where=valid.has(stage)?stage:'other';const kind=error?.name==='AbortError'?'timeout':error?.name==='SyntaxError'?'invalid_json':error?.message==='oversize'?'oversize_response':'request_error';return{state:kind+'_'+where,http_status:0,may_resubmit:false,release_reservation:false};}
export function spriteSafeRepairSelfTest(){const p=[
 strictReceipt3298([{problem:{id:3298},bid_id:32672,outcome:'closed'}],{originAuthenticated:true}).state==='BID_PRESENT_AMOUNT_UNKNOWN',
 strictReceipt3298([{problem:{id:3298},bid_id:32672,outcome:'closed',amount_cents:650}],{originAuthenticated:true}).state==='AMOUNT_MATCHED_PARTIAL_COVERAGE',
 strictReceipt3298([{problem:{id:3298},bid_id:32672,outcome:'closed',amount_cents:650}],{}).state==='UNTRUSTED_SOURCE',
 strictReceipt3298([{problem:{id:3298},bid_id:32672,outcome:'closed',amount:6.5}],{originAuthenticated:true}).state==='BID_PRESENT_AMOUNT_UNKNOWN',
 strictReceipt3298([{problem:{id:3298},bid_id:32672,outcome:'closed',amount_cents:650},{problem_id:3298,bid_id:99,status:'pending'}],{originAuthenticated:true}).state==='MULTIPLE_BIDS',
 parseVerifiedBudget({currency:'USD',budget_cents:650}).ok===true,
 parseVerifiedBudget({currency:'USD',price:6.5}).ok===false,
 parseVerifiedBudget({currency:'USD',budget_cents:650,budget:{cents:700}}).ok===false,
 classifyReceiptException({name:'AbortError'},'http').state==='timeout_http',
 classifyReceiptException({name:'Error',message:'secret'},'http').state==='request_error_http'];
 return{passed:p.every(Boolean),checks:p.length,bid_sent:false,may_proceed:false};
}
