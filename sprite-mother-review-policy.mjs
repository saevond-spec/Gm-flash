// SPRITE-ONLY. Independent Mother bid-review policy for PRIVATE RPC staging.
// No customer data; no live authorization. Production must replace synthetic
// evidence with authenticated marketplace retrieval by a trusted collector.
import {canonicalBidIntent} from './council-preflight.mjs';
const validInt=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const hold=reason=>({state:'hold',reason,can_submit:false,may_sign:false,reviewer:'mother'});
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function reviewMotherStageBid({intent,evidence,nowSec}={}){
 const canonical=canonicalBidIntent(intent);
 if(!canonical||intent.problem_id!=='999999991')return hold('stage_only_exact_intent_required');
 if(!validInt(nowSec,intent.created_at,intent.created_at+899))return hold('stale_intent');
 if(!isObject(evidence)||evidence.stage_marker!=='sprite-fictional-council-v1'
    ||evidence.source!=='fictional_mother_evidence'||evidence.canonical_intent!==canonical
    ||evidence.agent_id!==1878||evidence.problem_id!==intent.problem_id
    ||evidence.nonce!==intent.nonce)return hold('fictional_evidence_identity_mismatch');
 if(!validInt(evidence.collected_at,nowSec-120,nowSec)||evidence.task_status!=='bidding'
    ||evidence.currency!=='USD'||evidence.budget_cents!==intent.verified_budget_cents
    ||evidence.floor_cents!==intent.verified_floor_cents
    ||evidence.own_bid_exists!==false)
    return hold('mother_task_budget_or_bid_state_unverified');
 if(evidence.incremental_cost_cents!==0||evidence.isolated_delivery!==true
    ||evidence.scope_sha256!==intent.scope_sha256
    ||evidence.proposal_sha256!==intent.proposal_sha256
    ||evidence.deadline_feasible!==true)
    return hold('mother_delivery_scope_not_verified');
 const criteria=evidence.acceptance;
 if(!Array.isArray(criteria)||criteria.length<2||criteria.length>6)
    return hold('mother_acceptance_requirements_missing');
 const ids=new Set();
 for(const c of criteria){
   if(!isObject(c)||typeof c.id!=='string'||!/^[a-z0-9_-]{2,24}$/.test(c.id)
      ||ids.has(c.id)||typeof c.requirement!=='string'||c.requirement.length<15
      ||typeof c.verification_method!=='string'||c.verification_method.length<15
      ||c.deliverable_isolated!==true)return hold('mother_acceptance_coverage_invalid');
   ids.add(c.id);
 }
 return {state:'eligible_for_stage_signature',reason:null,reviewer:'mother',
   stage_only:true,can_submit:false,may_sign:true,
   canonical_intent:canonical,acceptance_count:criteria.length};
}
