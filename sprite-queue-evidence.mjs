// Sprite-only, read-only marketplace queue evidence extraction.
// No credentials, customer text, marketplace POST, or readiness attestation.
// Caller must independently authenticate GET /api/v1/bids/queue and verify freshness.
const validId=v=>/^[1-9][0-9]{0,9}$/.test(String(v??''));
const cents=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000000;
const ownBidKnown=v=>typeof v==='boolean';
const takeRows=v=>{
  const choices=[v,v?.data,v?.queue,v?.bids,v?.data?.queue,v?.data?.bids,v?.data?.items,
    v?.items,v?.results,v?.data?.results];
  return choices.find(Array.isArray)??null;
};
export function extractSpriteQueueEvidence(json,{authenticated=false,checkedAtSec,nowSec}={}){
  const fail=reason=>({state:'unverified',reason,rows:[],bid_ready_count:0,complete_market_scan:false});
  if(authenticated!==true)return fail('authenticated_get_unverified');
  if(!Number.isSafeInteger(nowSec)||!Number.isSafeInteger(checkedAtSec)||
     checkedAtSec>nowSec||nowSec-checkedAtSec>300)return fail('queue_evidence_stale');
  if(!json||typeof json!=='object'||json.error||json.ok===false||json.success===false)
    return fail('queue_response_invalid');
  const source=takeRows(json);
  if(!Array.isArray(source)||source.length>100)return fail('queue_shape_unrecognized');
  const rows=[],seen=new Set(),conflicts=new Set(),fingerprints=new Map();
  for(const item of source){
    if(!item||typeof item!=='object'||Array.isArray(item))continue;
    const id=String(item.problem_id??item.task_id??item.problem?.id??item.task?.id??'');
    if(!validId(id))continue;
    const floor=cents(item.price_floor_cents)&&item.price_floor_cents>0?item.price_floor_cents:null;
    const budget=cents(item.budget_cents)&&item.budget_cents>0?item.budget_cents:null;
    const bidState=Object.prototype.hasOwnProperty.call(item,'own_bid')?item.own_bid:
      Object.prototype.hasOwnProperty.call(item,'my_bid')?item.my_bid:
      Object.prototype.hasOwnProperty.call(item,'your_bid')?item.your_bid:undefined;
    const ownBid=bidState===null?false:bidState===false?false:
       bidState===undefined?'unverified':typeof bidState==='object'?'present':'unverified';
    const fp=JSON.stringify([floor,budget,ownBid]);
    if(fingerprints.has(id)){if(fingerprints.get(id)!==fp)conflicts.add(id);continue}
    fingerprints.set(id,fp);seen.add(id);
    const verifiedPrice=floor!==null&&budget!==null&&floor<=budget;
    // Queue alone cannot establish funding, deliverability, owner account, or approvals.
    rows.push({problem_id:id,price_floor_cents:floor,budget_cents:budget,
      price_evidence:verifiedPrice?'explicit_cents':'review_only_missing_or_conflicting_price',
      own_bid:ownBid,eligible_for_bid:false});
  }
  const clean=rows.filter(r=>!conflicts.has(r.problem_id)).sort((a,b)=>
    Number(a.problem_id)-Number(b.problem_id));
  return {state:'inspected',records_seen:source.length,unique_ids:seen.size,
    conflicts:[...conflicts].sort(),rows:clean,bid_ready_count:0,
    price_verified_count:clean.filter(r=>r.price_evidence==='explicit_cents').length,
    review_count:clean.filter(r=>r.price_evidence!=='explicit_cents').length,
    complete_market_scan:false,requires_fresh_authenticated_detail:true,
    requires_council_authorization:true};
}
