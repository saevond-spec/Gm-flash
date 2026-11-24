import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedMarketBounds,buildClawHuntBidRequest,bidGrossNetCents} from '../clawhunt-bid-contract.mjs';
import {exactBidReceipt} from '../bid-receipt.mjs';

const funded = Object.freeze({
  id:4183,status:'bidding',currency:'USD',bounty_type:'escrowed',escrow_status:'funded',
  escrow_funded:true,payment_evidence:'funded_escrow',price:9000,price_credits:90,
  reference_price:9000,reference_price_credits:90,escrow_amount:9000
});
const unheld = Object.freeze({
  id:4202,status:'bidding',currency:'USD',bounty_type:'escrowed',escrow_status:'none',
  escrow_funded:false,payment_evidence:'no_payment_recorded',price:0,price_credits:0,
  reference_price:9500,reference_price_credits:95,escrow_amount:0
});
const intent = (id,amount) => ({
  problem_id:String(id),agent_id:1878,amount_cents:amount,
  buyer_message:'I will prepare the agreed deliverable with reproducible checks and return the acceptance evidence.',
  proposal_text:'Deliver a verified task-specific result. First inspect the exact acceptance criteria, then implement the agreed scope in a dedicated customer workspace, compare every acceptance item to the output, and provide a concise evidence report. Access is required before starting.',
  estimated_time:'24 hours after authorized scope and workspace access',
  scope_details:{deliverables:'Task-specific result and evidence report',format:'Agreed artifact format',exclusions:'No unrelated access',materials:'Buyer-approved inputs',timeline:'24 hours after access',revisions:2,evidence:'Repeatable checks and acceptance log'}
});
test('funded public task resolves to cents, not credits',()=>{
  const b=verifiedMarketBounds(funded,{problem_id:4183,price_floor_cents:450,own_bid:false});
  assert.equal(b.ok,true);assert.equal(b.budget_cents,9000);assert.equal(b.price_floor_cents,450);assert.equal(b.funding_kind,'posting_funded');
});
test('no-escrow task uses reference price without claiming held funds',()=>{
  const b=verifiedMarketBounds(unheld);
  assert.equal(b.ok,true);assert.equal(b.budget_cents,9500);
  assert.equal(b.funding_kind,'reference_only_no_escrow');
});
test('simulated, missing and contradictory funding fail closed',()=>{
  for(const task of [
    {...funded,is_simulated:true},
    {...funded,escrow_amount:8000},
    {...funded,payment_evidence:'unknown'},
    {...funded,price_credits:9},
    {...funded,currency:'EUR'},
    {...unheld,reference_price:null},
  ])assert.equal(verifiedMarketBounds(task).ok,false);
});
test('queue identity and existing own bid block new execution',()=>{
  assert.equal(verifiedMarketBounds(funded,{problem_id:9999,price_floor_cents:450}).ok,false);
  assert.equal(verifiedMarketBounds(funded,{problem_id:4183,price_floor_cents:450,own_bid:{id:12}}).ok,false);
});
test('builds full documented ClawHunt bid request with bounded contractual scope',()=>{
  const b=verifiedMarketBounds(funded),req=buildClawHuntBidRequest(intent(4183,8000),b);
  assert.deepEqual(Object.keys(req),['amount','message','proposal_text','estimated_time','scope_details']);
  assert.equal(req.amount,8000);assert.equal(req.scope_details.revisions,2);
  assert.equal(bidGrossNetCents(8000).estimated_net_after_fee_cents,6000);
});
test('blocks bids under approved $20 floor, excessive prices and weak proposals',()=>{
  const b=verifiedMarketBounds(funded);
  for(const amount of [1999,9001,10000001])assert.throws(()=>buildClawHuntBidRequest(intent(4183,amount),b));
  assert.throws(()=>buildClawHuntBidRequest({...intent(4183,8000),proposal_text:'hello'},b));
  assert.throws(()=>buildClawHuntBidRequest({...intent(4183,8000),proposal_text:'placeholder '+intent(4183,8000).proposal_text},b));
});
test('documented ProblemBidResponse only counts with trusted submitted-target context',()=>{
  const receipt={success:true,data:{bid:{id:32672,status:'pending',agent:{id:1878},estimated_cost:650}}};
  assert.equal(exactBidReceipt(receipt,'3298',650),null);
  const out=exactBidReceipt(receipt,'3298',650,{submissionContext:true});
  assert.equal(out?.bid_id,'32672');assert.equal(out?.task_id_source,'authenticated_submission_target');
  assert.equal(exactBidReceipt(receipt,'3298',651,{submissionContext:true}),null);
  assert.equal(exactBidReceipt({data:{bid:{...receipt.data.bid,agent:{id:1890}}}},'3298',650,{submissionContext:true}),null);
});
test('legacy flat authenticated receipts remain compatible',()=>{
  const r=exactBidReceipt({data:{bid:{bid_id:12,problem_id:3298,agent_id:1878,amount_cents:650,status:'pending'}}},'3298',650);
  assert.equal(r?.bid_id,'12');assert.equal(r?.task_id_source,'receipt');
});
test('historical withdrawn status is preserved rather than reported as pending',()=>{
  const r=exactBidReceipt({data:{bid:{id:55,problem_id:3298,agent:{id:1878},estimated_cost:650,status:'withdrawn'}}},'3298',650);
  assert.equal(r?.status,'withdrawn');
});
