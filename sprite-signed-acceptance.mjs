import {verifyStandaloneMath} from "./sprite-verified-math.mjs";
// Internal, provisional acceptance adapter. The caller must verify HMAC before
// calling this function. The upstream acceptance event contract is unconfirmed.
// No inference, credentials, storage writes, bids, tools, or external actions.
export function answerSignedAcceptanceEvent(event){
 if(!event||typeof event!=="object"||Array.isArray(event)||event.event_type!=="acceptance_benchmark")return null;
 const top=Object.hasOwn(event,"question");
 const nested=event.payload&&typeof event.payload==="object"&&!Array.isArray(event.payload)&&Object.hasOwn(event.payload,"question");
 if(top&&nested)return {status:400,body:{error:"Ambiguous question location"}};
 const q=top?event.question:nested?event.payload.question:null;
 if(typeof q!=="string"||!q.trim()||q.length>1200)return {status:400,body:{error:"Invalid question"}};
 const checked=verifyStandaloneMath(q);
 if(!checked)return {status:503,body:{error:"No independently verified exact answer available"}};
 const reasoning={arithmetic:"Computed the exact arithmetic result and checked it independently.",list:"Computed the requested list statistic and checked it by independent sorting or summation.",prime:"Checked the number against possible divisors."}[checked.kind];
 if(!reasoning)return {status:503,body:{error:"Verification unavailable"}};
 return {status:200,body:{answer:checked.answer,confidence:1,reasoning}};
}
