export function exactBidReceipt(payload,problemId,amountCents,{allowList=false}={}){
 if(!payload||typeof payload!=="object"||payload.success===false||payload.ok===false||payload.error)return null;
 const roots=[payload,payload.data,payload.problem,payload.data?.problem].filter(x=>x&&typeof x==="object"&&!Array.isArray(x));
 if(roots.some(x=>x.success===false||x.ok===false||x.error))return null;
 const candidates=[];
 for(const d of roots){candidates.push(d.bid,d.proposal);if(allowList)for(const x of [d.bids,d.proposals]){if(Array.isArray(x)){if(x.length>200)return null;candidates.push(...x)}}}
 const ids=new Set();
 for(const b of candidates){if(!b||typeof b!=="object")continue;
 const id=String(b.bid_id??b.proposal_id??b.id??"");
 if(!/^[1-9][0-9]{0,12}$/.test(id)||String(b.problem_id??b.task_id??"")!==problemId||String(b.agent_id??"")!=="1878"||b.amount_cents!==amountCents)continue;
 if(!["pending","submitted","active","accepted","selected","rejected","withdrawn","lost","won","placed"].includes(String(b.status??"").toLowerCase()))continue;
 ids.add(id);}
 return ids.size===1?{bid_id:[...ids][0],problem_id:problemId,amount_cents:amountCents,agent_id:1878}:null;
}
