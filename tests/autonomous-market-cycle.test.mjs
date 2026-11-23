// End-to-end autonomous scheduler REHEARSAL: fake ClawHunt GET/POST responses,
// fictional signatures/receipts, in-memory SQLite. No keys, no network, no live writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {assessClawhuntBidGates} from '../clawhunt-market-gates.mjs';
import {authorizeAndReserveBid,sendReservedBidOnce} from '../council-release.mjs';

const T=1800000000,sha=x=>createHash('sha256').update(x).digest('hex');
const message=id=>'For synthetic task '+id+': clean CSV rows, verify every total, provide the output and an independently reproducible acceptance report.';
const sign=(role,intent)=>sha('FICTIONAL_SIGNER:'+role+canonicalBidIntent(intent));
const task=(id,extra={})=>({id,amount:650,budget:800,floor:500,created:Number(id),
 status:'open',funding:'held',selfOwned:false,ownBid:false,isolated:true,
 acceptance:true,simulated:false,deadline:true,...extra});
class Memory {
 constructor(){
  this.raw=new DatabaseSync(':memory:');
  this.raw.exec("CREATE TABLE bid_reservations(agent_id INTEGER NOT NULL CHECK(agent_id=1878),problem_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 500 AND 10000000),state TEXT NOT NULL CHECK(state IN ('reserved','submitted','uncertain','rejected')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(agent_id,problem_id));");
  this.raw.exec(readFileSync(new URL('../migrations/20261122_sprite_council_nonces.sql',import.meta.url),'utf8'));
  this.raw.exec("CREATE TABLE fake_outcomes(problem_id TEXT PRIMARY KEY,bid_id TEXT NOT NULL,agent_id INTEGER NOT NULL,amount_cents INTEGER NOT NULL)");
  this.raw.prepare("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,'3298',650,'uncertain')").run();
 }
 prepare(sql){const raw=this.raw;return {bind(...args){return {sql,args,async first(){return raw.prepare(sql).get(...args)??null;}}}}}
 async batch(stmts){
  this.raw.exec('BEGIN IMMEDIATE');
  try{const results=stmts.map(s=>({results:this.raw.prepare(s.sql).all(...s.args)}));this.raw.exec('COMMIT');return results}
  catch(e){this.raw.exec('ROLLBACK');throw e;}
 }
 async readState(id,nonce){const q=sql=>this.raw.prepare(sql);
  return {available:true,
   blocking_unresolved_bid:!!q("SELECT 1 FROM bid_reservations WHERE agent_id=1878 AND problem_id<>'3298' AND state IN ('reserved','uncertain') LIMIT 1").get(),
   existing_reservation:!!q("SELECT 1 FROM bid_reservations WHERE agent_id=1878 AND problem_id=?").get(id),
   nonce_seen:!!q("SELECT 1 FROM sprite_council_nonce_consumption WHERE nonce=?").get(nonce)};
 }
 acceptFakeReceipt(r){
  if(!r||r.source!=='fictional_authoritative_outcomes'||r.verified!==true||r.agent_id!==1878||
    r.bid_id!=='FAKE-BID-'+r.problem_id)return false;
  const row=this.raw.prepare("SELECT amount_cents,state FROM bid_reservations WHERE agent_id=1878 AND problem_id=?").get(r.problem_id);
  if(!row||row.state!=='uncertain'||row.amount_cents!==r.amount_cents)return false;
  this.raw.prepare("INSERT INTO fake_outcomes VALUES(?,?,?,?)").run(r.problem_id,r.bid_id,1878,r.amount_cents);
  this.raw.prepare("UPDATE bid_reservations SET state='submitted' WHERE agent_id=1878 AND problem_id=?").run(r.problem_id);
  return true;
 }
 count(sql){return this.raw.prepare(sql).get().n}
 close(){this.raw.close()}
}
const criteria={source:'official_criteria',verified:true,checked_at_sec:T-10,min_combined_characters:60,heartbeat_window_sec:900};
const agent={source:'authenticated_me',verified:true,agent_id:1878,admission_status:'approved',owner_active:true};
const standing=(id,overrides={})=>({source:'authenticated_standing',verified:true,
 held_back:false,account_paused:false,own_bid_exists:false,eligible_for_task:true,
 checked_at_sec:T-10,task_id:id,...overrides});
function build(task,db,heartbeatAck,overrides={}){
 const proposal=message(task.id);
 const intent={agent_id:1878,problem_id:task.id,amount_cents:task.amount,
  verified_budget_cents:task.budget,verified_floor_cents:task.floor,currency:'USD',
  incremental_cost_cents:0,proposal_sha256:sha(proposal),scope_sha256:sha('FAKE_ISOLATED_SCOPE_'+task.id),
  nonce:sha('FAKE_NONCE_'+task.id).slice(0,32),created_at:T};
 const approve=role=>({reviewer:role,decision:'approve',canonical_intent:canonicalBidIntent(intent),
  problem_id:task.id,amount_cents:task.amount,nonce:intent.nonce,approved_at:T,
  expires_at:T+500,signature:sign(role,intent)});
 const gate=()=>assessClawhuntBidGates({intent,proposalText:proposal,nowSec:T+1,
  criteria,agent,heartbeat:{status:200,agent_id:1878,ack_sec:heartbeatAck},
  standing:standing(task.id,overrides.standing),
  task:{source:'authenticated_detail',verified:true,id:task.id,currency:'USD',
    status:task.status,simulated:task.simulated,funding_status:task.funding,
    self_owned:task.selfOwned,own_bid_exists:task.ownBid,price_floor_cents:task.floor,
    budget_cents:task.budget,checked_at_sec:T,
    acceptance_verified:task.acceptance,isolated_delivery_verified:task.isolated,
    zero_incremental_cost:true,deadline_feasible:task.deadline,
    acceptance_ids:['file','totals'],covered_acceptance_ids:['file','totals']}});
 return {intent,mother:approve('mother'),nova:approve('nova'),control:approve('chatgpt_operator'),
  verifyMother:async (a)=>a.signature===sign('mother',intent),
  verifyNova:async (a)=>a.signature===sign('nova',intent),
  verifyControl:async (a)=>a.signature===sign('chatgpt_operator',intent),
  readLedger:async()=>db.readState(task.id,intent.nonce),
  independentFinalCheck:async()=>gate().eligible_for_further_independent_approval,
  proposalText:proposal,db,nowSec:T+1,gate};
}
async function tick(db,jobs,heartbeatAck,send,overrides={}){
 const inspected=jobs.map(j=>({job:j,args:build(j,db,heartbeatAck,overrides)}))
   .sort((a,b)=>a.job.created-b.job.created);
 let blocked=0;
 for(const {job,args}of inspected){
  if(!args.gate().eligible_for_further_independent_approval){blocked++;continue;}
  const grant=await authorizeAndReserveBid(args);
  if(!grant.reserved){blocked++;continue;}
  const sent=await sendReservedBidOnce({db,grant,proposalText:args.proposalText,
   nowSec:T+1,trustedNowSec:async()=>T+2,send:async body=>send(job,body)});
  return {inspected:inspected.length,blocked,task:job.id,grant,sent};
 }
 return {inspected:inspected.length,blocked,task:null,sent:null};
}
test('AUTONOMOUS REHEARSAL: 2 distinct jobs submitted over cycles, rejects self-owned/unfunded and preserves #3298',async()=>{
 const db=new Memory();const calls=[];
 const queue=[task('8001',{status:'assigned'}),task('8002',{selfOwned:true}),task('8003',{amount:650,funding:'none'}),task('8004',{amount:750})];
 try{
  const sender=async(j,b)=>{assert.equal(b.problem_id,j.id);calls.push(b);return {status:201}};
  const stale=await tick(db,queue,T-901,sender);
  assert.equal(stale.task,null);assert.equal(calls.length,0);
  const first=await tick(db,queue,T-5,sender);
  assert.equal(first.task,'8003');assert.equal(first.sent.attempted,true);assert.equal(first.sent.confirmed,false);
  const repeated=await tick(db,queue,T-5,sender);
  assert.equal(repeated.task,null);assert.equal(calls.length,1);
  assert.equal(db.acceptFakeReceipt({source:'fictional_authoritative_outcomes',verified:true,agent_id:1878,problem_id:'8003',bid_id:'FAKE-BID-8003',amount_cents:649}),false);
  assert.equal(db.acceptFakeReceipt({source:'fictional_authoritative_outcomes',verified:true,agent_id:1878,problem_id:'8003',bid_id:'FAKE-BID-8003',amount_cents:650}),true);
  const second=await tick(db,queue,T-5,sender);
  assert.equal(second.task,'8004');assert.equal(second.sent.attempted,true);
  assert.equal(calls.length,2);
  assert.equal(db.raw.prepare("SELECT state FROM bid_reservations WHERE problem_id='3298'").get().state,'uncertain');
 }finally{db.close()}
});
test('AUTONOMOUS REHEARSAL: price-floor drift and account hold prevent send; 503 outcome blocks next run',async()=>{
 const db=new Memory();let sends=0;
 try{
  const altered=task('8101',{amount:650,floor:750}),valid=task('8102',{amount:700,budget:900});
  const paused=await tick(db,[altered,valid],T-1,async()=>{sends++},{standing:{account_paused:true}});
  assert.equal(paused.task,null);assert.equal(sends,0);
  const a=await tick(db,[altered,valid],T-1,async()=>{sends++;return {status:503}});
  assert.equal(a.task,'8102');assert.equal(a.sent.confirmed,false);
  const b=await tick(db,[valid,task('8103')],T-1,async()=>{sends++});
  assert.equal(b.task,null);assert.equal(sends,1);
  assert.equal(db.count("SELECT COUNT(*) n FROM bid_reservations WHERE problem_id<>'3298' AND state='uncertain'"),1);
 }finally{db.close()}
});
test('AUTONOMOUS REHEARSAL: 96 round seeded quality-gate campaign never bypasses a failed marketplace prerequisite',async()=>{
 const mutations=[
  j=>j.status='completed',j=>j.selfOwned=true,j=>j.ownBid=true,j=>j.isolated=false,
  j=>j.acceptance=false,j=>j.simulated=true,j=>j.deadline=false,
  j=>j.floor=j.amount+1,j=>j.budget=j.amount-1,j=>j.status='assigned'
 ];
 let seed=0x92a1f931;const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 let rejected=0;
 for(let round=0;round<96;round++){
  const db=new Memory();let sends=0;
  try{
   const job=task(String(9000+round));mutations[next()%mutations.length](job);
   const result=await tick(db,[job],T-2,async()=>{sends++;return {status:201}});
   assert.equal(result.task,null);assert.equal(sends,0);
   assert.equal(db.count("SELECT COUNT(*) n FROM sprite_council_nonce_consumption"),0);
   rejected++;
  }finally{db.close()}
 }
 assert.equal(rejected,96);
});

test('AUTONOMOUS STRESS: 32 concurrent scheduler ticks for 10 funded jobs issue at most one POST',async()=>{
 const db=new Memory();let sends=0;
 try{
  const jobs=Array.from({length:10},(_,i)=>task(String(15001+i),{amount:500+i*100,budget:650+i*100}));
  const rounds=await Promise.all(Array.from({length:32},()=>tick(db,jobs,T-1,async()=>{
   sends++;return {status:201};
  })));
  assert.equal(rounds.filter(r=>r.sent?.attempted).length,1);
  assert.equal(sends,1);
  assert.equal(db.count("SELECT COUNT(*) n FROM sprite_council_nonce_consumption"),1);
  assert.equal(db.count("SELECT COUNT(*) n FROM bid_reservations WHERE problem_id<>'3298'"),1);
  assert.equal(db.raw.prepare("SELECT state FROM bid_reservations WHERE problem_id='3298'").get().state,'uncertain');
 }finally{db.close()}
});
test('AUTONOMOUS STRESS: 18 simulated successful cycles always require a distinct exact receipt before advancing',async()=>{
 const db=new Memory(),jobs=Array.from({length:18},(_,i)=>task(String(16001+i),{
  amount:500+(i%12)*100,budget:700+(i%12)*100
 }));
 let sends=0;
 try{
  for(let i=0;i<18;i++){
   const r=await tick(db,jobs,T-2,async()=>{sends++;return {status:201}});
   assert.equal(r.sent?.attempted,true);
   assert.equal(r.task,jobs[i].id);
   assert.equal(sends,i+1);
   const blocked=await tick(db,jobs,T-2,async()=>{sends++;return {status:201}});
   assert.equal(blocked.task,null);assert.equal(sends,i+1);
   const j=jobs[i];
   assert.equal(db.acceptFakeReceipt({source:'fictional_authoritative_outcomes',
    verified:true,agent_id:1878,problem_id:j.id,bid_id:'FAKE-BID-'+j.id,amount_cents:j.amount}),true);
  }
  assert.equal(db.count('SELECT COUNT(*) n FROM fake_outcomes'),18);
  assert.equal(db.count('SELECT COUNT(*) n FROM sprite_council_nonce_consumption'),18);
  assert.equal(db.raw.prepare("SELECT state FROM bid_reservations WHERE problem_id='3298'").get().state,'uncertain');
 }finally{db.close()}
});
test('AUTONOMOUS STRESS: wrong agent receipt cannot clear unknown bid or unblock another task',async()=>{
 const db=new Memory();let sends=0;
 try{
  const first=task('17001'),other=task('17002');
  const result=await tick(db,[first,other],T-2,async()=>{sends++;return {status:202}});
  assert.equal(result.task,'17001');
  const bad={source:'fictional_authoritative_outcomes',verified:true,agent_id:1879,
    problem_id:'17001',bid_id:'FAKE-BID-17001',amount_cents:650};
  assert.equal(db.acceptFakeReceipt(bad),false);
  assert.equal(db.acceptFakeReceipt({...bad,agent_id:1878,problem_id:'17002',bid_id:'FAKE-BID-17002'}),false);
  const blocked=await tick(db,[other],T-2,async()=>{sends++;return {status:201}});
  assert.equal(blocked.task,null);assert.equal(sends,1);
 }finally{db.close()}
});
test('AUTONOMOUS STRESS: repeated listing rows never produce duplicate attempts',async()=>{
 const db=new Memory();let sends=0;
 try{
  const j=task('18001');
  const list=Array.from({length:80},()=>({...j}));
  const outcome=await tick(db,list,T-2,async()=>{sends++;return {status:201}});
  assert.equal(outcome.task,'18001');assert.equal(sends,1);
  const after=await tick(db,list,T-2,async()=>{sends++;return {status:201}});
  assert.equal(after.task,null);assert.equal(sends,1);
 }finally{db.close()}
});

test('AUTONOMOUS REHEARSAL: unknown escrow evidence is allowed with valid budget and approvals',async()=>{
 const db=new Memory();let sends=0;
 try{
  const job=task('19001',{funding:undefined,amount:700,budget:900});
  const r=await tick(db,[job],T-1,async()=>{
   sends++;return {status:201};
  });
  assert.equal(r.task,job.id);
  assert.equal(r.sent.attempted,true);
  assert.equal(sends,1);
  assert.equal(db.acceptFakeReceipt({source:'fictional_authoritative_outcomes',
   verified:true,agent_id:1878,problem_id:job.id,bid_id:'FAKE-BID-'+job.id,amount_cents:700}),true);
 }finally{db.close()}
});
test('AUTONOMOUS REHEARSAL: unescrowed budget below quote still fails closed',async()=>{
 const db=new Memory();let sends=0;
 try{
  const job=task('19002',{funding:'none',amount:700,budget:600});
  const r=await tick(db,[job],T-1,async()=>{sends++;return {status:201}});
  assert.equal(r.task,null);assert.equal(sends,0);
 }finally{db.close()}
});
