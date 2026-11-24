import {generateFictionalUatPolicy,verifyFictionalUatPolicy} from './uat-severity-rehearsal.mjs';
import {buildDataDelivery} from "./data-delivery.mjs";
const profiles=Object.freeze({
 csv_cleanup:{label:"CSV cleanup and deduplication",scope:"Only scalar tabular data, exact duplicate removal, CSV export and integrity manifest.",exclusions:["No external scraping","No fuzzy matching","No private or customer data in this environment"],evidence:"Reproducible fictional CSV test, expected row counts and digest"},
 uat_severity_policy:{label:"Fictional UAT severity criteria and go-live gates",scope:"Four severity levels, eight fictitious examples, priority policy and release-blocking criteria.",exclusions:["No live application testing","No private customer data","No customer approvals or actual go-live decision"],evidence:"Reproducible generic documentation and deterministic priority checks"},
 arithmetic_reconciliation:{label:"Integer-cent reconciliation",scope:"Sum positive and negative integer-cent entries and compare against a declared total.",exclusions:["No bank account access","No tax or accounting certification","No customer data in this environment"],evidence:"Independent expected integer-cent totals"}
});
export function reconcile(entries,declared){
 if(!Array.isArray(entries)||entries.length<1||entries.length>500||!Number.isSafeInteger(declared)||entries.some(x=>!Number.isSafeInteger(x)||Math.abs(x)>100000000))throw Error("Invalid integer-cent reconciliation");
 const total=entries.reduce((a,b)=>a+b,0);const difference=total-declared;
 if(!Number.isSafeInteger(difference))throw Error("Unsafe difference");
 return {entries:entries.length,total_cents:total,declared_cents:declared,difference_cents:difference,matched:difference===0};
}
export async function rehearse(profile){
 if(!Object.hasOwn(profiles,profile))throw Error("Unsupported solver profile");
 if(profile==="uat_severity_policy"){
 const artifact=generateFictionalUatPolicy();const passed=verifyFictionalUatPolicy(artifact);
 return {passed,artifact,fixture_only:true,customer_solution_completed:false};
 }
 if(profile==="csv_cleanup"){
 const result=await buildDataDelivery({source_kind:"fictional",confirm_no_customer_data:true,columns:["item","units"],rows:[{item:"A",units:2},{item:"B",units:5},{item:"A",units:2}]});
 const expected='"item","units"\r\n"A","2"\r\n"B","5"\r\n';
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(expected))),x=>x.toString(16).padStart(2,"0")).join("");
 return {passed:result.csv===expected&&result.manifest.rows_out===2&&result.manifest.sha256===sha,artifact:result,expected_sha256:sha,fixture_only:true};
 }
 const artifact=reconcile([1200,-250,499,-99],1350);
 const check=artifact.total_cents===1350&&artifact.matched&&artifact.entries===4;
 const negative=reconcile([1200,-250,499,-99],1400);
 return {passed:check&&negative.difference_cents===-50&&!negative.matched,artifact,negative_control:negative,fixture_only:true};
}
export async function prepareBidPlan({profile,amount_cents,hours,cost_cents},qualification){
 if(!Object.hasOwn(profiles,profile)||!Number.isSafeInteger(amount_cents)||amount_cents<1||amount_cents>100000||!Number.isInteger(hours)||hours<1||hours>168||!Number.isSafeInteger(cost_cents)||cost_cents<0||cost_cents>100000)throw Error("Invalid plan parameters");
 const p=profiles[profile],proof=await rehearse(profile);
 const net=Math.floor(amount_cents*75/100)-cost_cents;
 const reasons=[...(qualification.reasons||[])];if(net<=0)reasons.push("nonpositive_net_after_declared_cost");
 if(!proof.passed)reasons.push("rehearsal_failed");
 return {profile,label:p.label,qualification,quote:{amount_cents,estimated_hours_operator_supplied:hours,declared_cost_cents:cost_cents,estimated_net_if_settled_cents:net,fee_assumption_percent:25},scope:p.scope,exclusions:p.exclusions,execution_evidence:proof,readiness:reasons.length===0?"candidate_for_manual_scope_review":"hold",reasons,task_scope_verified:false,customer_solution_completed:false,bid_submitted:false,requires_operator_review:true,note:"Fictional rehearsal proves only the narrow solver capability. Inspect exact buyer acceptance criteria and use an independent customer environment after assignment; this is not a completed customer solution."};
}
