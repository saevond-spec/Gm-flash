import test from "node:test";
import assert from "node:assert/strict";
import { BATCH_TASKS,buildSpriteScopedBidCopy as build } from "../sprite-direct-bid-copy-v186.mjs";
const detail=(id,override={})=>({
  id,problem_id:id,title:"【"+BATCH_TASKS[id][0]+"】 Public test-only example task, fictional buyer",
  status:"bidding",currency:"USD",escrow_status:"funded",bounty_type:"escrowed",
  price:11000,deadline:"2026-12-21T15:59:59",review_mode:"self",
  acceptance_criteria:"1. Prepare a complete, editable, fictional deliverable set with verified source references.\n2. Include exact count-based acceptance checks and evidence only after real tests.\n3. Avoid any private client material in the shared agent runtime.",
  ...override});
for (const [id,[code,kind]] of Object.entries(BATCH_TASKS)) {
 test("distinct operator-approved "+id+" "+kind,()=>{
  const p=build(detail(id),9800,{nowMs:Date.parse("2026-11-26T09:30:00Z")});
  assert.ok(p.message.includes(code));assert.ok(p.proposal_text.includes(id));
  assert.ok(p.proposal_text.includes("PUBLIC ACCEPTANCE ITEMS TO VERIFY:"));
  assert.ok(p.proposal_text.includes("dedicated job environment"));
  assert.ok(p.message.length>=10&&p.message.length<=1000);
  assert.ok(p.proposal_text.length>=120&&p.proposal_text.length<=5000);
  assert.equal(p.scope_details.revisions,2);
  assert.equal(p.amount,9800);
 });
}
test("campaign exactly 40 and unique",()=>assert.equal(new Set(Object.keys(BATCH_TASKS)).size,40));
test("reject unlisted prior-batch task",()=>assert.throws(()=>build({id:"3299",title:"【S2-WB-010】 test",status:"bidding"},9900)));
test("reject old #4188",()=>assert.throws(()=>build({id:"4188",title:"Blender test",status:"bidding"},9000)));
test("reject mismatched public task code",()=>assert.throws(()=>build(detail("3204",{title:"【S4-TRAIN-001】 Wrong task"}),9000)));
test("reject closed job",()=>assert.throws(()=>build(detail("3204",{status:"submitted"}),9000)));
test("reject simulated job",()=>assert.throws(()=>build(detail("3204",{is_simulated:1}),9000)));
test("reject expired deadline",()=>assert.throws(()=>build(detail("3204",{deadline:"2026-11-23T15:59:59"}),9000,{nowMs:Date.parse("2026-11-26T09:30:00Z")})));
test("reject unknown deadline",()=>assert.throws(()=>build(detail("3204",{deadline:null}),9000)));
test("reject invalid negative amount",()=>assert.throws(()=>build(detail("3204"),-100)));
test("reject unsupported currency",()=>assert.throws(()=>build(detail("3204",{currency:"EUR"}),9000)));
test("reject empty criteria",()=>assert.throws(()=>build(detail("3204",{acceptance_criteria:"TBD"}),9000)));
test("no private user attachments or credentials forwarded",()=>{
 const p=build(detail("3204",{privateAttachment:"CLIENT_ATTACHED_PRIVATE_SOURCE",clientKey:"SECRETTOKENCLIENT"}),9000);
 assert.ok(!JSON.stringify(p).includes("CLIENT_ATTACHED_PRIVATE_SOURCE"));
 assert.ok(!JSON.stringify(p).includes("SECRETTOKENCLIENT"));
});
test("no fabricated tests or completed work claimed",()=>{
 const p=build(detail("3204"),9000);
 assert.ok(p.proposal_text.includes("No tests, screenshots, citations or artifacts are claimed completed."));
});
