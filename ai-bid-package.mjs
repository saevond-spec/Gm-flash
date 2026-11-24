export function buildAIPackageInput(task,body){
 const id=String(body?.problem_id??"");
 if(!/^[1-9][0-9]{0,9}$/.test(id)||String(task?.id??task?.problem_id)!==id)throw Error("Task identity not verified");
 if(!["open","bidding"].includes(String(task.status).toLowerCase())||String(task.currency).toLowerCase()!=="usd")throw Error("Task is not open in USD");
 const profile=body.profile;if(!["csv_cleanup","arithmetic_reconciliation"].includes(profile))throw Error("Select a supported capability");
 const reference=Number(body.reference_cents);
 if(!Number.isSafeInteger(reference)||reference<500||reference>100000)throw Error("Enter a proposed quote between $5 and $1,000");
 const budget=Number.isSafeInteger(task.budget_cents)&&task.budget_cents>0?task.budget_cents:null;
 if(budget!==null&&budget<500)throw Error("Reported budget is below $5");
 const count=(v,max)=>Number.isSafeInteger(v)&&v>0&&v<=max?v:null;
 return {problem_id:id,profile,reported_budget_cents:budget,reference_cents:reference,max_quote_cents:Math.min(100000,budget??100000),examples:count(body.examples,100),boundaries:count(body.boundaries,100),spot_checks:count(body.spot_checks,100),language:body.language==="zh"?"zh":"en",reference_hours:count(body.reference_hours,168),scope_verified:false};
}
export function validateAIPackage(raw,input,review){
 if(typeof raw!=="string"||raw.length>18000)throw Error("AI did not return a usable draft");
 let o;try{o=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""))}catch{throw Error("AI response was not valid JSON; no fallback draft used")}
 if(!o||typeof o!=="object"||Array.isArray(o))throw Error("AI response invalid");
 const keys=["relevance","completeness","feasibility","acceptance","verification","scope","buyer_message","price_basis"];
 for(const k of keys)if(typeof o[k]!=="string"||o[k].trim().length<12||o[k].length>(k==="buyer_message"?500:200))throw Error("AI output incomplete: "+k);
 if(!Number.isSafeInteger(o.amount_cents)||o.amount_cents<500||o.amount_cents>input.max_quote_cents||!Number.isSafeInteger(o.hours)||o.hours<1||o.hours>168)throw Error("AI quote or delivery estimate outside verified limits");
 const zh=input.language==="zh",q=(o.amount_cents/100).toFixed(2);
 const headings=zh?["目标与相关性","步骤与交付物","可行性与依赖","验收标准","验证与证据","价格与范围"]:["Relevance","Completeness","Feasibility","Acceptance criteria","Verification and evidence","Price and scope"];
 const quote=zh?`USD ${q}；分配及范围确认后预计${o.hours}小时；`:`USD ${q}; estimated ${o.hours} hours after assignment and scope confirmation; `;
 const parts=[...keys.slice(0,5).map(k=>o[k].trim()),quote+o.scope.trim()];
 const proposal=headings.map((h,i)=>h+": "+parts[i]).join("\n");
 if(proposal.length>1000||!review(proposal).passed)throw Error("AI proposal fails six-section or length check; regenerate");
 return {proposal,buyer_message:o.buyer_message.trim()+"\n"+quote,amount_cents:o.amount_cents,hours:o.hours,price_basis:o.price_basis,reported_budget_cents:input.reported_budget_cents,net_estimate_cents:Math.floor(o.amount_cents*75/100),scope_verified:false,market_price_verified:input.reported_budget_cents!==null,posted:false,review_required:true};
}

export function boundAutonomousInput(input,row){
 if(!Number.isSafeInteger(row.amount_cents)||row.amount_cents<500||row.amount_cents>input.max_quote_cents||row.amount_cents>row.platform_limit_cents||!Number.isSafeInteger(row.hours)||row.hours<1||row.hours>168||row.cost_cents!==0||row.scope_verified!==1||row.isolated_environment_verified!==1)throw Error("Unverified autonomous terms");
 return {...input,max_quote_cents:row.amount_cents,min_quote_cents:row.amount_cents,fixed_hours:row.hours,reference_hours:row.hours,mode:"autonomous",scope_verified:true};
}
export function negotiationInput(input,b){
 if(b.mode!=="negotiation")return input;
 const offered=b.counteroffer_cents,current=b.current_quote_cents;
 if(!Number.isSafeInteger(offered)||offered<1||offered>100000||!Number.isSafeInteger(current)||current<500||current>100000)throw Error("Invalid negotiation amounts");
 return {...input,mode:"negotiation",operator_reported_counteroffer_cents:offered,operator_reported_current_quote_cents:current,min_quote_cents:500,max_quote_cents:Math.min(input.max_quote_cents,current),scope_verified:false};
}
export function validateBoundTerms(draft,input){
 if(!Number.isSafeInteger(draft.amount_cents)||draft.amount_cents<(input.min_quote_cents??500)||draft.amount_cents>input.max_quote_cents||!Number.isSafeInteger(draft.hours)||(input.fixed_hours!==undefined&&draft.hours!==input.fixed_hours))throw Error("AI changed verified terms");
 return draft;
}
