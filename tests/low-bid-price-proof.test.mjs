import test from "node:test";
import assert from "node:assert/strict";
import {qualifyTask,autonomousAmountAllowed} from "../worker.mjs";

// Sprite-only, fictional scalar fixtures. No customer text, source, credentials or wallets.
const task=(budget,extra={})=>({
  id:987654,
  status:"open",
  escrow_status:"held",
  currency:"USD",
  ...(budget===undefined?{}:{budget_cents:budget}),
  ...extra
});
const q=(budget,amount,extra={},allowUnescrowed=false)=>qualifyTask(task(budget,extra),"987654",amount,allowUnescrowed);

test("the first allowed $5 task has an explicit USD-cent budget",()=>{
  const r=q(500,500);
  assert.equal(r.eligible,true);
  assert.equal(r.budget_cents,500);
  assert.equal(autonomousAmountAllowed(500),true);
});
test("$7.50 easy bid may be reviewed when funded, not auto-submitted",()=>{
  const r=q(750,650);
  assert.equal(r.eligible,true);
  assert.equal(r.delivery_capability_verified,false);
});
test("$20 upper edge remains eligible for scope review",()=>{
  const r=q(2000,2000);
  assert.equal(r.eligible,true);
});
test("missing budget never becomes qualified solely because escrow says held",()=>{
  const r=q(undefined,null);
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("budget_cents_unverified"));
});
test("missing budget also blocks a $5 quote",()=>{
  const r=q(undefined,500);
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("budget_cents_unverified"));
});
test("a $4.99 posting is not eligible for a minimum-$5 bid",()=>{
  const r=q(499,null);
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("budget_outside_authorized_range"));
});
test("unknown units and bare budget numbers do not verify cents",()=>{
  const r=qualifyTask({id:987654,status:"open",escrow_status:"held",currency:"USD",budget:5},"987654");
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("budget_cents_unverified"));
});
test("non-USD quote is blocked",()=>{
  const r=q(1000,700,{currency:"EUR"});
  assert.equal(r.eligible,false);
});
test("simulated tasks cannot qualify",()=>{
  const r=q(1000,700,{is_simulated:true});
  assert.equal(r.eligible,false);
});
test("bid above verified posting budget cannot qualify",()=>{
  const r=q(700,701);
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("bid_above_budget"));
});
test("unescrowed bids do not require opt-in and payment is not guaranteed",()=>{
  const extra={escrow_status:"none",funded:false};
  const baseline=q(1000,700,extra,false);
  const legacy=q(1000,700,extra,true);
  assert.equal(baseline.eligible,true);
  assert.equal(legacy.eligible,true);
  assert.equal(baseline.payment_guaranteed,false);
  assert.equal(baseline.delivery_capability_verified,false);
});
test("a missing USD budget still blocks unescrowed bidding",()=>{
  const r=q(undefined,500,{escrow_status:"none"},true);
  assert.equal(r.eligible,false);
  assert.ok(r.reasons.includes("budget_cents_unverified"));
});
