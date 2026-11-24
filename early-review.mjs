export function earlyCandidates(record,excluded=[]){
 if(record?.outcome!=="scanned"||!Array.isArray(record.candidate_ids))return [];
 const ids=new Set(record.candidate_ids),seen=new Set(excluded);
 return (record.diagnostics?.detail_probes??[]).filter(x=>x.qualified===true&&ids.has(x.problem_id)&&typeof x.problem_id==="string"&&/^[1-9][0-9]{0,9}$/.test(x.problem_id)&&!seen.has(x.problem_id)&&seen.add(x.problem_id)&&["open","bidding"].includes(x.status)&&x.readiness_review!=="known_unsupported").map(x=>({id:x.problem_id,category:["research","coding","automation","data","design","other","writing","translation","testing","development","marketing"].includes(x.category)?x.category:null,budget_cents:Number.isSafeInteger(x.verified_budget_cents)&&x.verified_budget_cents>=500&&x.verified_budget_cents<=100000?x.verified_budget_cents:null})).sort((a,b)=>(a.budget_cents===null?2:a.budget_cents<=2500?0:1)-(b.budget_cents===null?2:b.budget_cents<=2500?0:1)).slice(0,3);
}
export function validateEarlyReview(raw,rows){
 if(typeof raw!=="string"||raw.length>8000)throw Error("AI response unavailable");
 const parsed=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""));
 const o=Array.isArray(parsed)?parsed:parsed?.reviews;
 if(!Array.isArray(o)||o.length!==rows.length||new Set(o.map(x=>x.id)).size!==rows.length)throw Error("Invalid review coverage");
 return rows.map(r=>{const x=o.find(x=>x.id===r.id);if(!x||!["price_and_scope","scope_only","unsupported_category"].includes(x.reason)||!Number.isInteger(x.priority)||x.priority<1||x.priority>3)throw Error("Invalid review");
 return {id:r.id,category:r.category,budget_cents:r.budget_cents,priority:x.priority,reason:r.budget_cents===null?"price_and_scope":x.reason,ready:false};});
}
