import test from 'node:test';
import assert from 'node:assert/strict';
import {filterSpriteScanCandidateIds as filter} from '../sprite-scan-simulation-filter.mjs';
const entry=id=>({problem_id:String(id),simulated:null,verification_state:'requires_live_verification'});
const goodDetail=id=>({problem_id:String(id),authenticated:true,identity_match:true,
  fresh_detail:true,simulated:false,escrow_status:'funded',escrow_funded:true,
  escrow_amount:9000,budget_cents:9000,payment_evidence:'authenticated_current_hold'});
test('known simulated #3226 is removed before scan persistence',()=>{
  const x=filter({ids:['2784','3226','2791'],inventoryRows:[
    entry(2784),{...entry(3226),simulated:1,verification_state:'public_page_simulated_nonpaying'},entry(2791)]});
  assert.deepEqual(x.candidate_ids,['2784','2791']);
  assert.equal(x.diagnostics.excluded_known_simulated,1);
});
test('unknown tasks stay reviewable but are not credited as real paid jobs',()=>{
  const x=filter({ids:['1','2'],inventoryRows:[entry(1),entry(2)]});
  assert.equal(x.verified_paying_candidate_count,0);
  assert.equal(x.diagnostics.needs_authenticity_verification,2);
  assert.ok(x.candidate_status.every(x=>!x.bid_authorized));
});
test('real payment requires independent explicit authenticated detail',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[goodDetail(1)]});
  assert.equal(x.verified_paying_candidate_count,1);
  assert.equal(x.candidate_status[0].funding_evidence_state,'authenticated_current_hold');
  assert.equal(x.candidate_status[0].bid_authorized,false);
});
test('funded label alone does not prove held funds',()=>{
  const x=filter({ids:['1'],inventoryRows:[{...entry(1),escrow_status:'funded',budget_cents:9000}]});
  assert.equal(x.verified_paying_candidate_count,0);
});
test('explicit no escrow permitted for review but not counted paid',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[{...goodDetail(1),escrow_status:'none',escrow_funded:false}]});
  assert.equal(x.candidate_ids.length,1);
  assert.equal(x.diagnostics.no_escrow_risk_not_confirmed_paid,1);
  assert.equal(x.verified_paying_candidate_count,0);
});
test('public immutable evidence excludes known simulated even absent inventory flag',()=>{
  const x=filter({ids:['1'],publicFundingEvidence:[{problem_id:'1',observed_simulated:1,evidence:'public_page_explicit_no_real_funds'}]});
  assert.deepEqual(x.candidate_ids,[]);
});
test('public evidence must have exact provenance',()=>{
  const x=filter({ids:['1'],publicFundingEvidence:[{problem_id:'1',observed_simulated:1,evidence:'unknown_claim'}]});
  assert.deepEqual(x.candidate_ids,['1']);
  assert.equal(x.verified_paying_candidate_count,0);
});
test('boolean true and numeric 1 both mark simulation',()=>{
  const x=filter({ids:['1','2'],inventoryRows:[{...entry(1),simulated:1},{...entry(2),simulated:true}]});
  assert.deepEqual(x.candidate_ids,[]);
});
test('latest inventory false does not erase prior known simulation',()=>{
  const x=filter({ids:['1'],inventoryRows:[{...entry(1),simulated:1},{...entry(1),simulated:false}]});
  assert.deepEqual(x.candidate_ids,[]);
});
test('latest inventory unknown does not erase prior known simulation',()=>{
  const x=filter({ids:['1'],inventoryRows:[{...entry(1),simulated:1},entry(1)]});
  assert.deepEqual(x.candidate_ids,[]);
});
test('reversed duplicate order still excludes simulations',()=>{
  const x=filter({ids:['1'],inventoryRows:[entry(1),{...entry(1),simulated:1}]});
  assert.deepEqual(x.candidate_ids,[]);
});
test('authenticated detail false cannot erase prior simulated detail',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[{...goodDetail(1),simulated:true},goodDetail(1)]});
  assert.deepEqual(x.candidate_ids,[]);
});
test('candidate record can carry simulation flag',()=>{
  const x=filter({ids:[{problem_id:'1',simulated:1},{problem_id:'2',simulated:0}]});
  assert.deepEqual(x.candidate_ids,['2']);
});
test('duplicate task is counted once',()=>{
  const x=filter({ids:['1','1','2']});
  assert.deepEqual(x.candidate_ids,['1','2']);
  assert.equal(x.diagnostics.duplicate,1);
});
test('garbled candidate IDs are excluded',()=>{
  const x=filter({ids:['0','a','1','1;DROP TABLE bid_reservations','99999999999',null,2]});
  assert.deepEqual(x.candidate_ids,['1','2']);
  assert.equal(x.diagnostics.invalid,5);
});
test('simulation takes precedence even if contradictory detail claims held money',()=>{
  const x=filter({ids:['1'],inventoryRows:[{...entry(1),simulated:1}],
    authenticatedDetails:[goodDetail(1)]});
  assert.equal(x.verified_paying_candidate_count,0);
  assert.deepEqual(x.candidate_ids,[]);
});
test('no customer data or credentials are exposed by output',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[{...goodDetail(1),secret:'DONT-LEAK-KEY',
    client_private_file:'DO-NOT-EXPOSE-PAYLOAD'}]});
  const body=JSON.stringify(x);
  assert.ok(!body.includes('DONT-LEAK-KEY'));
  assert.ok(!body.includes('DO-NOT-EXPOSE-PAYLOAD'));
});
test('output cannot authorize submission or delivery from scan alone',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[goodDetail(1)]});
  assert.equal(x.requires_separate_bid_authentication,true);
  assert.equal(x.detailed_scope_review_stage,'post_award');
  assert.equal(x.candidate_status[0].bid_authorized,false);
});
test('large inputs fail closed before expensive work',()=>{
  assert.throws(()=>filter({ids:Array(10001).fill('1')}),RangeError);
});
test('invalid arrays fail closed',()=>{
  assert.throws(()=>filter({ids:undefined,inventoryRows:{bad:true}}),TypeError);
});
test('invalid authenticated detail does not count paid',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[{...goodDetail(1),authenticated:false}]});
  assert.equal(x.verified_paying_candidate_count,0);
});
test('missing current hold evidence does not count paid',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[{...goodDetail(1),payment_evidence:undefined}]});
  assert.equal(x.verified_paying_candidate_count,0);
});
test('price conflicts do not count paid',()=>{
  const x=filter({ids:['1'],authenticatedDetails:[{...goodDetail(1),escrow_amount:8500}]});
  assert.equal(x.verified_paying_candidate_count,0);
});
test('documented source-independent selection result has no details or buyer text',()=>{
  const x=filter({ids:[{problem_id:'1',title:'PRIVATE-SCOPE'}],
    inventoryRows:[{problem_id:'1',description:'PRIVATE-BUYER-DATA'}]});
  assert.ok(!JSON.stringify(x).includes('PRIVATE-SCOPE'));
  assert.ok(!JSON.stringify(x).includes('PRIVATE-BUYER-DATA'));
});


test('prior Sprite reservations are excluded from the active scan',()=>{
  const x=filter({ids:['1','2','3'],reservationIds:['1']});
  assert.deepEqual(x.candidate_ids,['2','3']);
  assert.equal(x.diagnostics.excluded_prior_bid_or_reservation,1);
});
test('historical receipts cannot be accidentally bid again',()=>{
  const x=filter({ids:['1','2'],receiptIds:['2']});
  assert.deepEqual(x.candidate_ids,['1']);
});
test('own marketplace bid presence excluded even if no local receipt',()=>{
  const x=filter({ids:['1','2'],ownBidPresenceIds:['1']});
  assert.deepEqual(x.candidate_ids,['2']);
});
test('different duplicate signal sources count only once',()=>{
  const x=filter({ids:['1'],reservationIds:['1'],receiptIds:['1'],ownBidPresenceIds:['1']});
  assert.equal(x.diagnostics.excluded_prior_bid_or_reservation,1);
});
test('a known simulated bid stays classified simulated even if already reserved',()=>{
  const x=filter({ids:['1'],inventoryRows:[{...entry(1),simulated:1}],reservationIds:['1']});
  assert.equal(x.diagnostics.excluded_known_simulated,1);
  assert.equal(x.diagnostics.excluded_prior_bid_or_reservation,0);
});
test('invalid id arrays are rejected',()=>{
  assert.throws(()=>filter({ids:['1'],reservationIds:{bad:true}}),TypeError);
});
test('receipts may include structured problem identifiers',()=>{
  const x=filter({ids:['1','2'],receiptIds:[{problem_id:'2'}]});
  assert.deepEqual(x.candidate_ids,['1']);
});
test('simulated and prior bid exclusions do not certify unknowns as paid',()=>{
  const x=filter({ids:['1','2','3'],inventoryRows:[{...entry(1),simulated:1}],reservationIds:['2']});
  assert.deepEqual(x.candidate_ids,['3']);
  assert.equal(x.verified_paying_candidate_count,0);
});
