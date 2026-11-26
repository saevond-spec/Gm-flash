/**
 * Sprite #1878: public-metadata-only, bounded candidate review scheduler.
 * No secrets, customer files, model calls, network access, other agents,
 * database writes, bids or workspace provisioning.
 * Review selection is NOT permission to bid or proof of deliverability.
 */
const ID_RE=/^[1-9][0-9]{0,9}$/;
const OPEN=new Set(['open','bidding']);
const ESCROW=new Set(['held','funded','none','unfunded']);
const ORDER=['data','research','testing','automation','writing','backend','api','frontend','security','devops','other','unknown'];
function safeId(x){
  const v=x?.problem_id??x?.id;
  const id=typeof v==='number'&&Number.isSafeInteger(v)?String(v):typeof v==='string'?v:'';
  return ID_RE.test(id)?id:null;
}
function idSet(values){
  const out=new Set();
  for(const value of values??[]){const id=safeId({problem_id:value});if(id)out.add(id);}
  return out;
}
const money=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function selectPublicReviewCandidates(records,options={}){
  if(!Array.isArray(records))throw new TypeError('records must be an array');
  const nowMs=options.nowMs??Date.now(),maxAgeMs=options.maxAgeMs??3600000;
  const limit=options.limit??8,minCents=options.minReviewCents??2000,maxCents=options.maxReviewCents??10000000;
  if(!Number.isFinite(nowMs)||nowMs<946684800000||
     !Number.isFinite(maxAgeMs)||maxAgeMs<=0||maxAgeMs>86400000||
     !Number.isSafeInteger(limit)||limit<1||limit>100||
     !money(minCents,1,10000000)||!money(maxCents,minCents,10000000))
    throw new RangeError('invalid scheduler bounds');
  const excludedIds=new Set([...idSet(options.reservationIds),...idSet(options.receiptIds),
    ...idSet(options.ownBidPresenceIds),...idSet(options.blockedIds)]);
  const cooldowns=options.cooldowns instanceof Map?options.cooldowns:new Map();
  const exclusions=Object.create(null),latestById=new Map();
  const exclude=why=>{exclusions[why]=(exclusions[why]??0)+1;};
  const buckets=new Map(ORDER.map(cat=>[cat,[]]));
  // Reconcile duplicate observations before exclusion: an older or malformed
  // snapshot must not starve a later fresh observation for the same task.
  for(const item of records){
    const id=safeId(item);
    if(!id){exclude('invalid_task_id');continue;}
    const prior=latestById.get(id);
    if(prior){
      exclude('duplicate_listing');
      const currentAt=Date.parse(item?.last_seen_at??'');
      const priorAt=Date.parse(prior?.last_seen_at??'');
      if(Number.isFinite(currentAt)&&(!Number.isFinite(priorAt)||currentAt>priorAt))
        latestById.set(id,item);
      continue;
    }
    latestById.set(id,item);
  }
  for(const item of latestById.values()){
    const id=safeId(item);
    if(excludedIds.has(id)){exclude('already_bid_reserved_or_blocked');continue;}
    const cooldownUntil=Number(cooldowns.get(id));
    if(Number.isFinite(cooldownUntil)&&cooldownUntil>nowMs){exclude('cooldown');continue;}
    if(item?.simulated===1||item?.simulated===true||item?.is_simulated===true||item?.is_simulation===true){
      exclude('explicit_simulation');continue;
    }
    const state=String(item?.task_status??item?.status??'').toLowerCase();
    if(!OPEN.has(state)){exclude('not_open');continue;}
    const escrow=String(item?.escrow_status??'').toLowerCase();
    if(!ESCROW.has(escrow)){exclude('unverified_escrow_state');continue;}
    if(!money(item?.budget_cents,minCents,maxCents)){
      exclude('unknown_or_outside_review_budget');continue;
    }
    const observed=Date.parse(item?.last_seen_at??'');
    if(!Number.isFinite(observed)||observed>nowMs||nowMs-observed>maxAgeMs){
      exclude('stale_or_invalid_timestamp');continue;
    }
    const cat=typeof item?.category==='string'?item.category.trim().toLowerCase():'';
    const category=ORDER.includes(cat)?cat:'unknown';
    const previous=['unsupported_scope','not_reviewed','never_reviewed','calendar_verified_queued']
      .includes(item?.previous_review)?item.previous_review:'unknown';
    buckets.get(category).push({
      problem_id:id,category,observed_budget_cents:item.budget_cents,
      observed_escrow_status:escrow,last_seen_at:new Date(observed).toISOString(),
      previous_review:previous,
      simulation_evidence:item?.simulated===0||item?.simulated===false
        ?'reported_not_simulated':'unknown_requires_verification',
      review_status:'review_required',bid_ready:false,observed
    });
  }
  for(const b of buckets.values()){
    b.sort((a,b)=>b.observed-a.observed||b.observed_budget_cents-a.observed_budget_cents||
      a.problem_id.localeCompare(b.problem_id));
  }
  // Greedy category-fair scheduling. Scores rank *review*, not win probability.
  const chosen=[];
  while(chosen.length<limit){
    let progressed=false;
    for(const category of ORDER){
      const next=buckets.get(category).shift();
      if(!next)continue;
      const {observed,...publicMetadata}=next;
      chosen.push(publicMetadata);progressed=true;
      if(chosen.length>=limit)break;
    }
    if(!progressed)break;
  }
  return {candidates:chosen,diagnostics:{examined:records.length,unique_listings:latestById.size,
    selected_for_review:chosen.length,excluded:{...exclusions},
    bid_submissions:0,status:'read_only_candidate_review'}};
}
/** Fresh bid-stage evidence only; a customer workspace is required before delivery. */
export function assessBidStageEvidence(evidence){
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
    return {ready:false,missing:['task_evidence'],delivery_workspace_required_after_award:true};
  const required=['approved_sprite_identity','fresh_task_identity','open_non_simulated_task',
    'independently_verified_public_scope','demonstrated_delivery_capability',
    'zero_additional_spend_plan','verified_price_and_deadline','accurate_complete_proposal',
    'clear_duplicate_and_uncertain_status','authorized_bid_submission'];
  const missing=required.filter(x=>evidence[x]!==true);
  return {ready:missing.length===0,missing,delivery_workspace_required_after_award:true,
    workspace_attestation_is_prebid_requirement:false};
}
