// Read-only reasoning context; no customer material, tools, or model calls.
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export function spriteReasoningEvidence(row,now=Date.now()){
 const timestamp=typeof row?.observed_at==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(row.observed_at)?Date.parse(row.observed_at):NaN;
 const age=Number.isFinite(timestamp)&&Number.isFinite(now)&&timestamp<=now?Math.floor((now-timestamp)/1000):null;
 const fresh=age!==null&&age<=900;
 const examined=count(row?.records_examined),funded=count(row?.funded_candidates),bids=count(row?.bids_submitted);
 const coherent=examined!==null&&funded!==null&&funded<=examined&&bids!==null;
 return {kind:"recorded_scan_summary",state:age===null?"unavailable":!coherent?"inconsistent":fresh?"recent":"stale",observed_at:age===null?null:new Date(timestamp).toISOString(),age_seconds:age,records_examined:coherent?examined:null,funded_candidates:coherent?funded:null,scan_bids_submitted:coherent?bids:null,scope:"one recorded scan, not account totals or proof of a bid receipt"};
}
export const REASONING_RULES="Reasoning quality: identify the requested deliverable and constraints; distinguish observations, assumptions and conclusions; check arithmetic, units, counterexamples and alternative explanations; use only provided evidence for current operational claims. A recent scan is not proof of delivery, payment, a receipt, or global market availability. Stale, inconsistent, or unavailable evidence must be identified as such. For current external facts not supplied, say verification is needed. Do not invent citations, sources, completed actions or confidence percentages. Answer in the requested format, concise with a brief checkable explanation when appropriate.";
export const GEMMA_REASONING_ROLE="Produce a complete standalone answer. Independently evaluate the question before any other model response. Identify relevant evidence, test a plausible alternative, and state important uncertainty. Do not add unsupported facts.";
export const FLASH_REASONING_ROLE="Act as a critical second reviewer, not a majority voter. Solve the original question using the given evidence and constraints; then compare the untrusted Gemma answer. Agreement is not verification. Check assumptions, arithmetic, missing evidence, and alternative explanations. Correct identifiable errors and explicitly flag material disagreements you cannot resolve. Return a single useful answer in the requested format; never claim independent external validation or executed work.";
