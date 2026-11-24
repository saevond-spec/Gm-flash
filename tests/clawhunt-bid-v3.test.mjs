import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTaskPrice,validateBidPackage,classifyBidReceipt,nextPageOffset} from '../clawhunt-marketplace-v3.mjs';
import {submitAuthorizedBid} from '../sprite-submit-v3.mjs';
const scope={deliverables:'CSV and integrity manifest',format:'UTF-8 CSV',exclusions:'No private files',materials:'Public synthetic fixture',timeline:'One working day',revisions:1,evidence:'Row-count checksum and deterministic replay'};
const bid={problem_id:'4183',amount_cents:9000,message:'I will produce the specified deliverable, test every listed criterion and provide a reproducible checksum.',proposal_text:'The work includes deterministic parsing, a documented export, individual acceptance checks, and a repeatable verification run without copying private customer data.',estimated_time:'24 hours',scope_details:scope};
const task={id:4183,status:'bidding',currency:'USD',escrow_funded:true,escrow_status:'funded',price:9000,escrow_amount:9000,bounty_type:'escrowed'};
const queue={problem_id:4183,price_floor_cents:450};
const bounds=normalizeTaskPrice(task,queue);
test('funded and unfunded reference prices have independent paths',()=>{
 assert.equal(bounds.budget_cents,9000);
 assert.equal(normalizeTaskPrice({...task,escrow_funded:false,escrow_status:'none',price:0,reference_price:9500},{problem_id:4183,price_floor_cents:475}).funding,'reference_unheld');
 assert.throws(()=>normalizeTaskPrice({...task,escrow_funded:false,escrow_status:'none',reference_price:9500},{problem_id:4183,price_floor_cents:475},{allowUnfunded:false}));
});
test('payload carries complete approved proposal and scope',()=>{
 const body=validateBidPackage(bid,bounds);assert.equal(body.amount,9000);assert.equal(body.scope_details.revisions,1);
 assert.throws(()=>validateBidPackage({...bid,proposal_text:'placeholder'},bounds));
});
test('no more unknown pagination on repeated page',()=>{
 assert.equal(nextPageOffset({offset:0,limit:20,returned:20,uniqueNew:20}),20);
 assert.equal(nextPageOffset({offset:20,limit:20,returned:20,uniqueNew:0}),null);
});
test('receipt requires exact 4-way binding and handles published nested shape',()=>{
 const receipt={data:{bid:{id:456,problem_id:4183,agent:{id:1878},estimated_cost:9000,status:'pending'}}};
 assert.equal(classifyBidReceipt(receipt,{problem_id:'4183',agent_id:1878,amount_cents:9000}).confirmed,true);
 assert.equal(classifyBidReceipt(receipt,{problem_id:'4183',agent_id:1878,amount_cents:8000}).confirmed,false);
 assert.equal(classifyBidReceipt({data:{bid:{id:456,agent:{id:1878},estimated_cost:9000,status:'pending'}}},{problem_id:'4183',agent_id:1878,amount_cents:9000}).confirmed,false);
});
test('no network request without valid signed authorization',async()=>{
 let calls=0;
 const got=await submitAuthorizedBid({env:{CPH_API_KEY:'cph_mock'},intent:bid,bounds,verifyApproval:async()=>false,ledger:{reserve:async()=>{throw Error('should not reserve')},markSubmitting:async()=>true,confirm:async()=>true,unknown:async()=>true},fetchImpl:async()=>{calls++;throw Error('unexpected')}});
 assert.equal(got.state,'approval_denied');assert.equal(calls,0);
});
test('authorized request submits complete payload exactly once after durable transition',async()=>{
 const events=[];
 const ledger={reserve:async()=>{events.push('reserve');return {ok:true,id:'r1'}},markSubmitting:async()=>{events.push('submitting');return true},confirm:async()=>{events.push('confirm');return true},unknown:async()=>{events.push('unknown');return true}};
 const got=await submitAuthorizedBid({env:{CPH_API_KEY:'cph_mock'},intent:bid,bounds,verifyApproval:async()=>{events.push('verify');return true},ledger,fetchImpl:async(url,opt)=>{events.push('post');assert.match(url,/4183\/bid$/);assert.equal(JSON.parse(opt.body).scope_details.revisions,1);return new Response(JSON.stringify({data:{bid:{id:456,problem_id:4183,agent:{id:1878},estimated_cost:9000,status:'pending'}}}),{status:200,headers:{'content-type':'application/json'}})}});
 assert.deepEqual(events,['verify','reserve','submitting','post','confirm']);
 assert.equal(got.state,'CONFIRMED');
});
test('ambiguous network errors stay UNKNOWN and are never retried',async()=>{
 const states=[];let sends=0;
 const got=await submitAuthorizedBid({env:{CPH_API_KEY:'cph_mock'},intent:bid,bounds,verifyApproval:async()=>true,ledger:{reserve:async()=>({ok:true,id:'r2'}),markSubmitting:async()=>true,confirm:async()=>{throw Error('no receipt')},unknown:async x=>{states.push(x.reason);return true}},fetchImpl:async()=>{sends++;throw Error('timeout')}});
 assert.equal(got.state,'UNKNOWN');assert.equal(sends,1);assert.equal(states.length,1);
});
