import test from "node:test";
import assert from "node:assert/strict";
import {assessIsolation,REQUIRED_ISOLATION} from "../customer-isolation.mjs";
const controls=Object.fromEntries(REQUIRED_ISOLATION.map(x=>[x,true]));
test("customer claims cannot establish infrastructure isolation",()=>{
 for(const provider of ["dedicated_worker","dynamic_workers","isolated_container"]){
 const r=assessIsolation({job_id:"123",environment_id:"sprite-job-123-0123456789abcdef",provider,verified_controls:controls},{trusted:true});
 assert.equal(r.customer_execution_allowed,false);assert.equal(r.automatic_bid_allowed,false);assert.equal(r.attestation_accepted,false);
 }
});
test("cross-job environment identifiers are rejected",()=>{
 const r=assessIsolation({job_id:"123",environment_id:"sprite-job-456-0123456789abcdef",provider:"dedicated_worker",verified_controls:controls});
 assert.ok(r.reasons.includes("environment_job_binding_invalid"));assert.ok(r.reasons.includes("infrastructure_network_default_deny_unverified"));
});
test("missing evidence blocks every required control",()=>{
 const r=assessIsolation({job_id:"123",environment_id:"sprite-job-123-0123456789abcdef",provider:"dedicated_worker"});
 for(const c of REQUIRED_ISOLATION)assert.ok(r.reasons.includes("missing_"+c));
 assert.equal(r.eligible,false);
});
