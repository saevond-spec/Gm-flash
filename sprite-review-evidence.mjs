// Diagnostic classification only: never grants eligibility or authorizes payment.
export function classifyReviewEvidence(task){
 if(!task||typeof task!=="object"||!Object.hasOwn(task,"review_mode"))return "missing";
 const value=task.review_mode;
 if(value===null)return "null";
 if(typeof value!=="string")return "invalid_type";
 const mode=value.trim().toLowerCase();
 if(mode==="self")return "explicit_self";
 if(mode==="platform")return "explicit_platform";
 return mode===""?"empty":"unknown_value";
}
