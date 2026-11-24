import {extractPublicBidRequirements} from './sprite-public-bid-requirements.mjs';
import {verifiedMarketBounds} from './clawhunt-bid-contract.mjs';
export function buildAIPackageInput(task,body){
 const id=String(body?.problem_id??"");
 if(!/^[1-9][0-9]{0,9}$/.test(id)||String(task?.id??task?.problem_id)!==id)throw Error("Task identity not verified");
 if(!["open","bidding"].includes(String(task.status).toLowerCase())||String(task.currency).toLowerCase()!=="usd")throw Error("Task is not open in USD");
 const profile=body.profile;if(!["csv_cleanup","arithmetic_reconciliation"].includes(profile))throw Error("Select a supported capability");
 const reference=Number(body.reference_cents);
 if(!Number.isSafeInteger(reference)||reference<2000||reference>100000)throw Error("Enter a proposed quote between $20 and $1,000");
 const official=verifiedMarketBounds(task);
 const budget=official.ok?official.budget_cents:(Number.isSafeInteger(task.budget_cents)&&task.budget_cents>0?task.budget_cents:null);
 let publicBrief=null;try{publicBrief=extractPublicBidRequirements(task)}catch{/* Normal manual draft may lack a full public task spec. */}

 if(budget!==null&&budget<500)throw Error("Reported budget is below $5");
 const count=(v,max)=>Number.isSafeInteger(v)&&v>0&&v<=max?v:null;
 return {problem_id:id,profile,reported_budget_cents:budget,reference_cents:reference,max_quote_cents:Math.min(100000,budget??100000),examples:count(body.examples,100),boundaries:count(body.boundaries,100),spot_checks:count(body.spot_checks,100),language:body.language==="zh"?"zh":"en",reference_hours:count(body.reference_hours,168),scope_verified:false,
  ...(publicBrief??{})};
}
export function validateAIPackage(raw,input,review){
 if(typeof raw!=="string"||raw.length>18000)throw Error("AI did not return a usable draft");
 let o;try{o=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""))}catch{throw Error("AI response was not valid JSON; no fallback draft used")}
 if(!o||typeof o!=="object"||Array.isArray(o))throw Error("AI response invalid");
 const keys=["relevance","completeness","feasibility","acceptance","verification","scope","buyer_message","price_basis"];
 for(const k of keys){
  const limit=k==="buyer_message"?850:k==="price_basis"?300:780;
  if(typeof o[k]!=="string"||o[k].trim().length<20||o[k].length>limit)
   throw Error("AI output incomplete or oversized: "+k);
 }
 if(!Number.isSafeInteger(o.amount_cents)||o.amount_cents<2000||o.amount_cents>input.max_quote_cents||!Number.isSafeInteger(o.hours)||o.hours<1||o.hours>168)throw Error("AI quote or delivery estimate outside verified limits");
 const expected=Array.isArray(input.public_criteria)?input.public_criteria:[];
 let checks=[];
 if(input.mode==="autonomous"){
  if(!expected.length||!Array.isArray(o.acceptance_checks)||o.acceptance_checks.length!==expected.length)
   throw Error("Missing exact buyer acceptance coverage");
  const used=new Set();
  for(const check of o.acceptance_checks){
   if(!check||!Number.isSafeInteger(check.index)||check.index<1||check.index>expected.length||used.has(check.index)||
    typeof check.plan!=="string"||check.plan.trim().length<25||check.plan.length>220||
    typeof check.evidence!=="string"||check.evidence.trim().length<20||check.evidence.length>190)
    throw Error("Invalid buyer acceptance proof");
   used.add(check.index);checks[check.index-1]=check;
  }
  if(used.size!==expected.length)throw Error("Incomplete acceptance mapping");
 }
 const zh=input.language==="zh",q=(o.amount_cents/100).toFixed(2);
 const headings=zh?["目标与相关性","步骤与交付物","可行性与依赖","验收标准","验证与证据","价格与范围"]:["Relevance","Completeness","Feasibility","Acceptance criteria","Verification and evidence","Price and scope"];
 const quote=zh?`USD ${q}；分配及范围确认后预计${o.hours}小时；`:`USD ${q}; estimated ${o.hours} hours after assignment and scope confirmation; `;
 const acceptance=checks.length?o.acceptance.trim()+"\n"+checks.map((c,i)=>`AC${i+1} (${expected[i].slice(0,80)}): ${c.plan.trim()} | Evidence: ${c.evidence.trim()}`).join("\n"):o.acceptance.trim();
 const parts=[o.relevance.trim(),o.completeness.trim(),o.feasibility.trim(),acceptance,o.verification.trim(),quote+o.scope.trim()];
 const proposal=headings.map((h,i)=>h+": "+parts[i]).join("\n");
 const buyer_message=o.buyer_message.trim()+"\n"+quote;
 if(proposal.length>5000||proposal.length<300||buyer_message.length>1000||
   /(?:placeholder|lorem ipsum|占位)/i.test(proposal+"\n"+buyer_message)||!review(proposal).passed)
   throw Error("AI draft lacks checkable criteria or exceeds marketplace limits");
 return {proposal,buyer_message,amount_cents:o.amount_cents,hours:o.hours,
   price_basis:o.price_basis,reported_budget_cents:input.reported_budget_cents,
   net_estimate_cents:Math.floor(o.amount_cents*75/100),scope_verified:false,
   acceptance_criteria_covered:checks.length,market_price_verified:input.reported_budget_cents!==null,
   posted:false,review_required:true};
}

export function boundAutonomousInput(input,row){
 if(!Array.isArray(input.public_criteria)||input.public_criteria.length<1||
     typeof input.public_scope!=='string'||!input.public_scope)
   throw Error("Exact public acceptance criteria required before autonomous proposal");
 if(!Number.isSafeInteger(row.amount_cents)||row.amount_cents<2000||row.amount_cents>input.max_quote_cents||row.amount_cents>row.platform_limit_cents||!Number.isSafeInteger(row.hours)||row.hours<1||row.hours>168||row.cost_cents!==0||row.scope_verified!==1||row.isolated_environment_verified!==1)throw Error("Unverified autonomous terms");
 return {...input,max_quote_cents:row.amount_cents,min_quote_cents:row.amount_cents,fixed_hours:row.hours,reference_hours:row.hours,mode:"autonomous",scope_verified:true};
}
export function negotiationInput(input,b){
 if(b.mode!=="negotiation")return input;
 const offered=b.counteroffer_cents,current=b.current_quote_cents;
 if(!Number.isSafeInteger(offered)||offered<1||offered>100000||!Number.isSafeInteger(current)||current<2000||current>100000)throw Error("Invalid negotiation amounts");
 return {...input,mode:"negotiation",operator_reported_counteroffer_cents:offered,operator_reported_current_quote_cents:current,min_quote_cents:2000,max_quote_cents:Math.min(input.max_quote_cents,current),scope_verified:false};
}
export function validateBoundTerms(draft,input){
 if(!Number.isSafeInteger(draft.amount_cents)||draft.amount_cents<(input.min_quote_cents??2000)||draft.amount_cents>input.max_quote_cents||!Number.isSafeInteger(draft.hours)||(input.fixed_hours!==undefined&&draft.hours!==input.fixed_hours))throw Error("AI changed verified terms");
 return draft;
}
