import test from "node:test";
import assert from "node:assert/strict";
import {BATCH_TASKS,buildSpriteScopedBidCopy as build} from "../sprite-direct-bid-copy-v184.mjs";
const task=(id,extra={})=>({id,problem_id:id,
 title:"Fictional buyer work ["+BATCH_TASKS[id]?.[0]+"] public sample task",
 status:"bidding",currency:"USD",bounty_type:"escrowed",escrow_status:"funded",
 acceptance_criteria:"1. Produce an editable sample with three required fields.\n2. Verify all four fictional cases and include screenshots.\n3. Document the rules and list exceptions.",
 ...extra});
for(const [id,[code,kind]] of Object.entries(BATCH_TASKS)){
 test("operator scope job "+id+" ["+kind+"] produces valid unique exact buyer copy",()=>{
   const result=build(task(id),12500,{nowMs:Date.parse("2026-11-26T08:50:00Z")});
   assert.equal(result.amount,12500);
   assert.ok(result.message.includes(code));assert.ok(result.proposal_text.includes(code));
   assert.ok(result.proposal_text.length>=120&&result.proposal_text.length<=5000);
   assert.ok(result.message.length>=10&&result.message.length<=1000);
   assert.ok(result.estimated_time.length<=100);
   assert.equal(result.scope_details.revisions,2);
   assert.ok(result.proposal_text.includes("No tests, screenshots, citations or artifacts are claimed completed."));
 });
}
test("only exactly twenty explicit task ids are authorized",()=>assert.equal(Object.keys(BATCH_TASKS).length,20));
test("reject unlisted task",()=>assert.throws(()=>build({id:"123",title:"Other",status:"bidding"},9000)));
test("reject wrong title code",()=>assert.throws(()=>build(task("2573",{title:"Fictional different project"}),9000)));
test("reject unknown simulation",()=>assert.throws(()=>build(task("2573",{simulated:true}),9000)));
test("reject closed job",()=>assert.throws(()=>build(task("2573",{status:"closed"}),9000)));
test("reject missing buyer acceptance",()=>assert.throws(()=>build(task("2573",{acceptance_criteria:"N/A"}),9000)));
test("reject quote over connector maximum",()=>assert.throws(()=>build(task("2573"),100001)));
test("public past deadline must be disclosed to buyer",()=>{const r=build(task("2573",{deadline:"2026-11-23T15:59:59"}),12500,{nowMs:Date.parse("2026-11-26T08:50:00Z")});assert.ok(r.message.includes("past bidding deadline"));assert.ok(r.proposal_text.includes("past bidding deadline"));});
test("no customer secrets or buyer file content included in result",()=>{
 const r=build(task("2573",{secret_token:"CUSTOMER_SECRET_DONT_SHARE",buyer_attachment:"PRIVATE-CUSTOMER-PDF"}),9000);
 assert.ok(!JSON.stringify(r).includes("CUSTOMER_SECRET_DONT_SHARE"));
 assert.ok(!JSON.stringify(r).includes("PRIVATE-CUSTOMER-PDF"));
});
test("sanitizes disallowed placeholder text before marketplace contract",()=>{
 const r=build(task("2573",{acceptance_criteria:"1. Placeholder rows with example-only identifiers.\n2. Provide screenshots and labels.\n3. Check all fictional errors."}),9000);
 assert.ok(!/placeholder|lorem ipsum/i.test(r.proposal_text));
});
