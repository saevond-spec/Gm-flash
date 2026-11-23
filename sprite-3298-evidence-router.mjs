// Sprite-only READ-ONLY source router for the original #3298 uncertain bid.
// No network calls, credential access, signer, POST, or ledger writes.
// An authenticated response, if any, is a CANDIDATE ONLY for separately
// authenticated exact-receipt verification in sprite-authoritative-reconciliation.
// Never infer non-submission from a 403, empty list or aggregate bid_count.
import {classifySpriteReceiptEvidence} from './sprite-authoritative-reconciliation.mjs';
const ROUTES=new Map([
 ['task_detail','/api/v1/problems/3298'],
 ['bid_history','/api/v1/problems/3298/bids'],
 ['bid_outcomes','/api/v1/bids/outcomes']
]);
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const asArray=(r,name)=>{
  if(Array.isArray(r))return r;
  if(!isObj(r))return null;
  const d=isObj(r.data)?r.data:null;
  const problem=isObj(d?.problem)?d.problem:isObj(r.problem)?r.problem:null;
  const variants=name==='bid_outcomes'?
    [r.outcomes,d?.outcomes,r.items,d?.items,r.results,d?.results,r.data]:
    [r.bids,d?.bids,problem?.bids,r.proposals,d?.proposals,problem?.proposals,
      r.items,d?.items,r.results,d?.results,r.data];
  return variants.find(Array.isArray)??null;
};
const hold=(reason,diagnostics=[])=>({
 state:'unresolved',reason,may_resubmit:false,confirmed:false,
 may_mark_submitted:false,requires_independent_receipt_verification:true,
 diagnostics
});
export function routeSprite3298Evidence({
 problemId='3298',amountCents=650,observations
}={}){
 if(problemId!=='3298'||amountCents!==650||!Array.isArray(observations)
   ||observations.length>8)return hold('invalid_exact_probe');
 const diagnostics=[],candidates=[];
 let hasDenied=false,hasAmbiguity=false,hasIncomplete=false,hasUnauthorized=false;
 for(const item of observations){
  if(!isObj(item)||!ROUTES.has(item.route)||
     item.path!==ROUTES.get(item.route)||
     item.method!=='GET'||!Number.isInteger(item.http_status)){
    hasUnauthorized=true;
    diagnostics.push({route:'unknown',state:'invalid_provenance'});
    continue;
  }
  const route=item.route;
  if(item.http_status===401||item.http_status===403){
   hasDenied=true;diagnostics.push({route,state:'access_denied_not_no_bid',status:item.http_status});
   continue;
  }
  if(item.http_status!==200){
   diagnostics.push({route,state:'upstream_unavailable',status:item.http_status});
   continue;
  }
  if(item.authenticated_private_collector!==true||item.agent_id!==1878){
   hasUnauthorized=true;diagnostics.push({route,state:'private_identity_unverified'});
   continue;
  }
  if(route==='task_detail'){
   // ClawHunt task's aggregate bid_count does not identify the bidder.
   // Only explicit bidder records (if any) may become candidates.
   const count=item.body?.data?.problem?.bid_count??item.body?.problem?.bid_count??item.body?.bid_count;
   const list=asArray(item.body,route);
   if(list===null)diagnostics.push({route,state:'aggregate_only',reported_count:Number.isSafeInteger(count)?count:null});
   else if(list.length>100)diagnostics.push({route,state:'oversize_list'});
   else{
    const r=classifySpriteReceiptEvidence({problemId,amountCents,
      records:list.map(b=>({source_type:'authenticated_bid_record',authenticated:true,bid:b}))});
    diagnostics.push({route,state:r.state,reason:r.reason??null});
    if(r.state==='exact_receipt_candidate')candidates.push(r.bid_id);
    else if(r.reason==='multiple_conflicting_bid_ids'||r.reason==='contradictory_authoritative_record')
      hasAmbiguity=true;
   }
  }else{
   const list=asArray(item.body,route);
   if(list===null){diagnostics.push({route,state:'not_an_individual_bid_list'});continue;}
   if(list.length>100){diagnostics.push({route,state:'oversize_list'});continue;}
   if(list.length===0){diagnostics.push({route,state:'empty_list_not_negative_proof'});continue;}
   // A problem-level outcome without bid identity is incomplete, not proof
   // of a *contradictory* bid. Preserve uncertainty and report the real gap.
   const scoped=list.filter(b=>isObj(b)&&String(b.problem_id??b.task_id??'')===problemId);
   if(scoped.some(b=>(b.bid_id===undefined&&b.proposal_id===undefined)||b.amount_cents===undefined||
       (b.agent_id===undefined&&b.agent?.id===undefined))){
     diagnostics.push({route,state:'incomplete_own_bid_record',seen:list.length});
     hasIncomplete=true;
     continue;
   }
   // Do not assert the whole result is authoritative: exact match first,
   // separate private official-source verification always remains mandatory.
   const r=classifySpriteReceiptEvidence({problemId,amountCents,
     records:scoped.map(b=>({source_type:route==='bid_outcomes'?'authenticated_market_outcomes':'authenticated_bid_record',
         authenticated:true,bid:{...b,problem_id:String(b.problem_id??b.task_id??''),agent_id:b.agent_id??b.agent?.id}}))});
   diagnostics.push({route,state:r.state,reason:r.reason??null,seen:list.length});
   if(r.state==='exact_receipt_candidate')candidates.push(r.bid_id);
   else if(r.reason==='multiple_conflicting_bid_ids'||r.reason==='contradictory_authoritative_record')
     hasAmbiguity=true;
  }
 }
 const unique=[...new Set(candidates)];
 if(hasAmbiguity||unique.length>1)return hold('conflicting_marketplace_records',diagnostics);
 if(hasIncomplete&&unique.length>0)return hold('incomplete_records_prevent_confirmation',diagnostics);
 if(hasUnauthorized)return hold('authenticated_provenance_incomplete',diagnostics);
 if(unique.length===1)
   return {...hold('independently_verify_exact_candidate',diagnostics),
     state:'exact_candidate_only',candidate_bid_id:unique[0],
     known_denied_routes:hasDenied,confirmed:false};
 return hold(hasDenied?'bid_history_access_denied_without_exact_receipt':
   'no_exact_receipt_found_in_visible_sources',diagnostics);
}
