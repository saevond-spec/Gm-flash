import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {solveWorkflow,parseQuotedCsv,verifyCsvFields} from "../solve-workflow.mjs";
const base={source_kind:"fictional",confirm_no_customer_data:true,columns:["item","amount_cents"],rows:[{item:"F01",amount_cents:2500},{item:"F02",amount_cents:-400},{item:"F03",amount_cents:900},{item:"F01",amount_cents:2500}],reconciliation:{column:"amount_cents",declared_total_cents:3000},acceptance:{expected_unique_rows:3,expected_duplicates:1,expected_total_cents:3000,require_balance:true}};
test("complete deliverable workflow passes eight explicit checks and retains evidence digest",async()=>{
 const r=await solveWorkflow(base);assert.equal(r.release_status,"eligible_for_operator_review");assert.equal(r.evidence.checks.length,8);assert.ok(r.evidence.checks.every(c=>c.pass));assert.equal(r.reconciliation.total_cents,3000);assert.equal(r.evidence_sha256,createHash("sha256").update(JSON.stringify(r.evidence)).digest("hex"));assert.equal(r.evidence.customer_acceptance_verified,false);
});
test("wrong requirements are reported and block release rather than being silently changed",async()=>{
 const r=await solveWorkflow({...base,reconciliation:{...base.reconciliation,declared_total_cents:3100},acceptance:{...base.acceptance,expected_unique_rows:4,expected_total_cents:3100}});
 assert.equal(r.release_status,"blocked_by_failed_acceptance");
 assert.deepEqual(r.evidence.checks.filter(c=>!c.pass).map(c=>c.id),["unique_rows","total_cents","balance"]);
});
test("workflow refuses arbitrary instructions, private inputs and numeric coercion",async()=>{
 for(const x of [{...base,command:"run shell"},{...base,source_kind:"customer"},{...base,confirm_no_customer_data:false},{...base,rows:[{item:"F01",amount_cents:"3000"}]},{...base,acceptance:{...base.acceptance,require_balance:"true"}}])await assert.rejects(solveWorkflow(x));
});

test("independent CSV parser verifies quotes, commas, newlines, Unicode and injection escapes",async()=>{
 const input={...base,columns:["item","amount_cents","note"],rows:[{item:"F01",amount_cents:2500,note:'quoted "word", comma\r\n第二行'},{item:"F02",amount_cents:-400,note:" \t=1+1"},{item:"F03",amount_cents:900,note:"café"},{item:"F01",amount_cents:2500,note:'quoted "word", comma\r\n第二行'}]};
 const r=await solveWorkflow(input);assert.equal(r.release_status,"eligible_for_operator_review");
 const roundtrip=r.evidence.checks.find(c=>c.id==="csv_field_roundtrip");assert.equal(roundtrip.pass,true);assert.equal(roundtrip.actual,12);
 assert.deepEqual(parseQuotedCsv(r.csv)[2],["F02","-400","' \t=1+1"]);
});
test("CSV decoder detects corrupted content even when dimensions are unchanged",()=>{
 const c=["item","amount_cents"],rows=[{item:"X",amount_cents:100}];
 const good='"item","amount_cents"\r\n"X","100"\r\n';
 assert.equal(verifyCsvFields(good,c,rows).pass,true);
 for(const bad of [good.replace("100","101"),good.replace('"X"','"Y"'),good.slice(0,-2),good+'"Z","1"\r\n',good.replace('"X"','X')])assert.equal(verifyCsvFields(bad,c,rows).pass,false);
});
