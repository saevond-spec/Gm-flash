// Controlled multi-bid simulations. All tasks, signatures, API receipts and money are FICTIONAL.
// The only database is ephemeral SQLite in memory. There is NO network/client credential.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {authorizeAndReserveBid,sendReservedBidOnce} from '../council-release.mjs';

const NOW=1800000000;
const sha=x=>createHash('sha256').update(x).digest('hex');
const signature=(role,canonical)=>sha('FICTION_ONLY_'+role+'|'+canonical);
const fakeScope=sha('FICTIONAL_CSV_SCOPE_ISOLATED');
const message=id=>'Clean synthetic CSV for task '+id+', verify row counts and totals, and deliver a reproducible test report.';
const makeTask=(n,extra={})=>{
  const amount=500+(n%12)*125;
  return {id:String(7000+n),amount,budget:Math.min(2000,amount+125),floor:500,
    currency:'USD',status:'bidding',escrow:'held',simulated:false,
    scope:true,acceptance:true,isolated:true,netCost:0,ownBid:false,...extra};
};
class SQLiteLedger {
  constructor(){
    this.raw=new DatabaseSync(':memory:');
    this.raw.exec("CREATE TABLE bid_reservations(agent_id INTEGER NOT NULL CHECK(agent_id=1878),problem_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 500 AND 10000000),state TEXT NOT NULL CHECK(state IN ('reserved','submitted','uncertain','rejected')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(agent_id,problem_id));");
    this.raw.exec(readFileSync(new URL('../migrations/20261122_sprite_council_nonces.sql',import.meta.url),'utf8'));
    this.raw.exec("CREATE TABLE sprite_bid_receipts(problem_id TEXT PRIMARY KEY,bid_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,agent_id INTEGER NOT NULL)");
    this.raw.prepare("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,'3298',650,'uncertain')").run();
  }
  prepare(sql){
    const self=this;
    return {bind(...args){return {sql,args,async first(){return self.raw.prepare(sql).get(...args)??null;}};}};
  }
  async batch(stmts){
    this.raw.exec('BEGIN IMMEDIATE');
    try{
      const results=stmts.map(s=>({results:this.raw.prepare(s.sql).all(...s.args)}));
      this.raw.exec('COMMIT');return results;
    }catch(e){this.raw.exec('ROLLBACK');throw e;}
  }
  async readState(id,nonce){
    const current=this.raw.prepare("SELECT 1 as a FROM bid_reservations WHERE agent_id=1878 AND problem_id=?").get(id);
    const blocking=this.raw.prepare("SELECT 1 as a FROM bid_reservations WHERE agent_id=1878 AND problem_id<>'3298' AND state IN ('reserved','uncertain') LIMIT 1").get();
    const used=this.raw.prepare("SELECT 1 as a FROM sprite_council_nonce_consumption WHERE nonce=?").get(nonce);
    return {available:true,blocking_unresolved_bid:!!blocking,existing_reservation:!!current,nonce_seen:!!used};
  }
  exactReceipt(task,bidId){
    // Simulated *authoritative* receipt records, not proof of actual ClawHunt acceptance.
    if(typeof bidId!=='string'||!bidId.startsWith('FAKE-'))return false;
    const r=this.raw.prepare("SELECT amount_cents,state FROM bid_reservations WHERE agent_id=1878 AND problem_id=?").get(task.id);
    if(!r||r.state!=='uncertain'||r.amount_cents!==task.amount)return false;
    this.raw.prepare("INSERT INTO sprite_bid_receipts(problem_id,bid_id,amount_cents,agent_id) VALUES(?,?,?,1878)").run(task.id,bidId,task.amount);
    this.raw.prepare("UPDATE bid_reservations SET state='submitted' WHERE agent_id=1878 AND problem_id=? AND amount_cents=? AND state='uncertain'").run(task.id,task.amount);
    return true;
  }
  close(){this.raw.close();}
}
const approval=(role,intent)=>{
 const c=canonicalBidIntent(intent);
 return {reviewer:role,decision:'approve',canonical_intent:c,problem_id:intent.problem_id,
  amount_cents:intent.amount_cents,nonce:intent.nonce,approved_at:NOW,expires_at:NOW+500,
  signature:signature(role,c)};
};
const scenario=(task,ledger)=>{
 const proposal=message(task.id);
 const intent={agent_id:1878,problem_id:task.id,amount_cents:task.amount,
  verified_budget_cents:task.budget,verified_floor_cents:task.floor,currency:'USD',incremental_cost_cents:0,
  proposal_sha256:sha(proposal),scope_sha256:fakeScope,nonce:Number(task.id).toString(16).padStart(32,'0'),
  created_at:NOW};
 const live=async x=>x.problem_id===task.id&&x.amount_cents===task.amount
  &&task.currency==='USD'&&task.status==='bidding'&&task.escrow==='held'&&!task.simulated
  &&task.scope&&task.acceptance&&task.isolated&&!task.netCost&&!task.ownBid
  &&task.amount>=task.floor&&task.amount<=task.budget;
 const nova=approval('nova',intent),control=approval('chatgpt_operator',intent);
 return {intent,nova,control,proposalText:proposal,db:ledger,nowSec:NOW+2,
  verifyNova:async (a,c)=>a.signature===signature('nova',c),
  verifyControl:async (a,c)=>a.signature===signature('chatgpt_operator',c),
  readLedger:async id=>ledger.readState(id,intent.nonce),
  independentFinalCheck:live};
};
async function tryBid(args,sender){
 const grant=await authorizeAndReserveBid(args);
 if(grant.state!=='reserved_for_one_submission')return {grant,transport:null};
 const transport=await sendReservedBidOnce({db:args.db,grant,proposalText:args.proposalText,send:sender});
 return {grant,transport};
}
test('SIMULATION: 12 sequential distinct $5-$20 bids, 12 exact fictional receipts, legacy #3298 untouched',async()=>{
 const db=new SQLiteLedger();const sent=[];
 try{
  for(let i=0;i<12;i++){
   const task=makeTask(i),args=scenario(task,db);
   const {grant,transport}=await tryBid(args,async body=>{
    assert.equal(body.problem_id,task.id);assert.equal(body.amount_cents,task.amount);
    assert.equal(body.message,message(task.id));
    const count=sent.filter(x=>x.problem_id===task.id).length;assert.equal(count,0);
    sent.push(body);return {status:201};
   });
   assert.equal(grant.state,'reserved_for_one_submission',JSON.stringify(grant));
   assert.equal(transport.attempted,true);
   assert.equal(transport.confirmed,false,'HTTP 201 is NOT a confirmed receipt');
   assert.equal(db.exactReceipt(task,'FAKE-'+task.id),true);
  }
  assert.equal(sent.length,12);
  assert.equal(db.raw.prepare("SELECT COUNT(*) as n FROM sprite_bid_receipts").get().n,12);
  assert.equal(db.raw.prepare("SELECT state FROM bid_reservations WHERE problem_id='3298'").get().state,'uncertain');
  assert.equal(db.raw.prepare("SELECT COUNT(*) as n FROM sprite_council_nonce_consumption").get().n,12);
 }finally{db.close();}
});
test('SIMULATION: 24 parallel attempts for the SAME bid send only once via real SQLite uniqueness',async()=>{
 const db=new SQLiteLedger();let sent=0;
 try{
  const args=scenario(makeTask(20),db);
  const trials=await Promise.all(Array.from({length:24},()=>tryBid(args,async()=>{
    sent++;return {status:201};
  })));
  assert.equal(trials.filter(x=>x.grant.reserved).length,1);
  assert.equal(trials.filter(x=>x.transport?.attempted).length,1);
  assert.equal(sent,1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) as n FROM sprite_council_nonce_consumption").get().n,1);
 }finally{db.close();}
});
test('SIMULATION: 10 different jobs in parallel never create multiple unresolved transport attempts',async()=>{
 const db=new SQLiteLedger();let sent=0;
 try{
  const tasks=Array.from({length:10},(_,i)=>makeTask(i+40));
  const trials=await Promise.all(tasks.map(task=>tryBid(scenario(task,db),async()=>{sent++;return {status:202}})));
  assert.equal(trials.filter(x=>x.grant.reserved).length,1);
  assert.equal(sent,1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) as n FROM bid_reservations WHERE problem_id<>'3298' AND state='uncertain'").get().n,1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) as n FROM sprite_council_nonce_consumption").get().n,1);
 }finally{db.close();}
});
test('SIMULATION: lost response holds subsequent bidding without duplicating the first',async()=>{
 const db=new SQLiteLedger();let sendCount=0;
 try{
  const first=await tryBid(scenario(makeTask(62),db),async()=>{sendCount++;throw Error('FICTIONAL_TIMEOUT');});
  assert.equal(first.transport.state,'uncertain');assert.equal(first.transport.confirmed,false);
  const second=await tryBid(scenario(makeTask(63),db),async()=>{sendCount++;return {status:201}});
  assert.equal(second.grant.can_submit,false);assert.equal(second.transport,null);
  assert.equal(sendCount,1);
 }finally{db.close();}
});
test('SIMULATION: fake HTTP 429 and HTTP 500 are uncertain, not retries or confirmed bids',async()=>{
 for(const status of [429,500]){
  const db=new SQLiteLedger();let calls=0;
  try{
   const task=makeTask(71);
   const one=await tryBid(scenario(task,db),async()=>{calls++;return {status}});
   const two=await tryBid(scenario(task,db),async()=>{calls++;return {status}});
   assert.equal(one.transport.upstream_status,status);assert.equal(one.transport.confirmed,false);
   assert.equal(two.transport,null);assert.equal(calls,1);
  }finally{db.close();}
 }
});
test('SIMULATION: missing scope, no escrow, above floor, over budget or prior bid block all sends',async()=>{
 const cases=[
  {scope:false},{acceptance:false},{isolated:false},{escrow:'none'},
  {floor:1900},{budget:600},{ownBid:true},{simulated:true},{status:'completed'}, {currency:'EUR'}
 ];
 for(let i=0;i<cases.length;i++){
  const db=new SQLiteLedger();let count=0;
  try{
   const task=makeTask(88,cases[i]);
   const r=await tryBid(scenario(task,db),async()=>{count++;return {status:201}});
   assert.equal(r.grant.can_submit,false,JSON.stringify(cases[i]));
   assert.equal(count,0);assert.equal(db.raw.prepare('SELECT COUNT(*) as n FROM sprite_council_nonce_consumption').get().n,0);
  }finally{db.close();}
 }
});
test('SIMULATION: fake Nova deny, mismatched proposal, stale approval, or unverified operator hold without send',async()=>{
 const db=new SQLiteLedger();let sends=0;
 try{
  const task=makeTask(94);
  const base=scenario(task,db);
  const invalid=[
   {...base,nova:{...base.nova,decision:'hold'}},
   {...base,nova:{...base.nova,signature:'bad'}},
   {...base,control:{...base.control,signature:'not-the-operator'}},
   {...base,nowSec:NOW+901},
   {...base,intent:{...base.intent,amount_cents:500}},
  ];
  for(const args of invalid){
   const r=await tryBid(args,async()=>{sends++;return {status:201}});
   assert.equal(r.grant.can_submit,false);assert.equal(r.transport,null);
  }
  assert.equal(sends,0);assert.equal(db.raw.prepare('SELECT COUNT(*) as n FROM sprite_council_nonce_consumption').get().n,0);
 }finally{db.close();}
});
test('SIMULATION: proposal text changed after council authorization fails before network claim',async()=>{
 const db=new SQLiteLedger();let sends=0;
 try{
  const args=scenario(makeTask(111),db);
  const grant=await authorizeAndReserveBid(args);
  assert.equal(grant.reserved,true);
  const transport=await sendReservedBidOnce({db,grant,proposalText:'Altered proposal with entirely different scope',send:async()=>{sends++}});
  assert.equal(transport.state,'proposal_hash_mismatch');assert.equal(sends,0);
  assert.equal(db.raw.prepare("SELECT state FROM bid_reservations WHERE problem_id=?").get(args.intent.problem_id).state,'reserved');
 }finally{db.close();}
});
test('SIMULATION: stale or fabricated receipt cannot clear an uncertain reservation',async()=>{
 const db=new SQLiteLedger();
 try{
  const task=makeTask(117);
  const first=await tryBid(scenario(task,db),async()=>({status:201}));
  assert.equal(first.transport.state,'uncertain');
  assert.equal(db.exactReceipt({...task,amount:task.amount+1},'FAKE-'+task.id),false);
  assert.equal(db.exactReceipt(task,'bogus'),false);
  assert.equal(db.raw.prepare('SELECT state FROM bid_reservations WHERE problem_id=?').get(task.id).state,'uncertain');
  assert.equal(db.exactReceipt(task,'FAKE-'+task.id),true);
 }finally{db.close();}
});
