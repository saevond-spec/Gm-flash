// Reporting only. Never grants bidding eligibility or modifies reservation/receipt authority.
const id=x=>typeof x==="string"||typeof x==="number"?/^[1-9][0-9]{0,12}$/.test(String(x))?String(x):null:null;
const cents=x=>Number.isSafeInteger(x)&&x>0?x:null;
export function summarizePostBidEvidence({reservation,direct,own,queue}={}){
 const reserved=cents(reservation?.amount_cents),d=id(direct?.bid_id),o=id(own?.bid_id),q=id(queue?.bid_id);
 const directAmount=cents(direct?.amount_cents),ownAmount=cents(own?.observed_amount_cents),queueAmount=cents(queue?.marketplace_price_cents);
 const queueBound=!!(q&&o&&q===o&&queue?.identity_match===1&&queue?.evidence_source==="authenticated_bid_queue");
 const conflict=!!(d&&o&&d!==o||own?.amount_verification==="conflict"||reserved&&d&&directAmount!==reserved||reserved&&o&&ownAmount!==null&&ownAmount!==reserved||queue?.identity_match===1&&o&&q&&o!==q||queueBound&&reserved&&queueAmount!==null&&queueAmount!==reserved);
 if(conflict)return {state:"conflicting_evidence",bid_id:null};
 if(d&&reserved&&directAmount===reserved)return {state:"exact_submission_receipt",bid_id:d};
 if(o&&reserved&&own?.amount_verification==="matched"&&ownAmount===reserved)return {state:"authenticated_outcome_amount_match",bid_id:o};
 if(queueBound&&reserved&&queue?.amount_match===1&&queueAmount===reserved&&cents(queue?.reserved_price_cents)===reserved)return {state:"authenticated_presence_queue_amount_match",bid_id:o};
 if(o)return {state:"authenticated_presence",bid_id:o};
 return {state:"unconfirmed",bid_id:null};
}
