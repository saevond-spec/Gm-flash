// SPRITE-ONLY independent Nova risk/freshness assessor for private RPC staging.
// Does not trust Mother verdict as substitute for independent market checks.
// This stage function cannot approve ANY real ClawHunt task.
import {canonicalBidIntent} from './council-preflight.mjs';
const okInt=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const bad=reason=>({state:'hold',reason,can_submit:false,may_sign:false,reviewer:'nova'});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function reviewNovaStageBid({intent,evidence,nowSec}={}){
 const canonical=canonicalBidIntent(intent);
 if(!canonical||intent.problem_id!=='999999991')return bad('stage_only_exact_intent_required');
 if(!okInt(nowSec,intent.created_at,intent.created_at+899))return bad('stale_intent');
 if(!object(evidence)||evidence.stage_marker!=='sprite-fictional-council-v1'
    ||evidence.source!=='fictional_nova_evidence'||evidence.canonical_intent!==canonical
    ||evidence.agent_id!==1878||evidence.problem_id!==intent.problem_id
    ||evidence.nonce!==intent.nonce
    ||!okInt(evidence.observed_at,nowSec-120,nowSec))
    return bad('nova_independent_evidence_missing');
 if(evidence.agent_standing!=='eligible'||evidence.owner_active!==true
    ||evidence.heartbeat_age_sec>120||!okInt(evidence.heartbeat_age_sec,0,120)
    ||evidence.market_bid_allowed!==true||evidence.duplicate_bid_detected!==false)
    return bad('nova_market_standing_or_duplicate_unverified');
 if(evidence.currency!=='USD'||evidence.task_status!=='bidding'
    ||evidence.simulated_task!==true // Stage deliberately *only* permits fictional task
    ||evidence.verified_budget_cents!==intent.verified_budget_cents
    ||evidence.verified_floor_cents!==intent.verified_floor_cents
    ||evidence.quote_cents!==intent.amount_cents
    ||evidence.verified_floor_cents>intent.amount_cents
    ||evidence.verified_budget_cents<intent.amount_cents)
    return bad('nova_market_quote_unverified');
 if(evidence.proposal_sha256!==intent.proposal_sha256
    ||evidence.scope_sha256!==intent.scope_sha256
    ||evidence.delivery_feasible!==true||evidence.incremental_cost_cents!==0
    ||evidence.reservation_conflict!==false||evidence.nonce_seen!==false)
    return bad('nova_scope_cost_or_replay_risk');
 return {state:'eligible_for_stage_signature',reason:null,reviewer:'nova',
    stage_only:true,can_submit:false,may_sign:true,canonical_intent:canonical};
}
