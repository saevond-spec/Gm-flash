import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {releaseExpiredNeverSentSpriteReservation} from '../sprite-safe-expiry-recovery.mjs';

const EXP=1800000500, nonce='f'.repeat(32), hash='a'.repeat(64);
class Stage {
 constructor(){
  this.raw=new DatabaseSync(':memory:');
  this.raw.exec("CREATE TABLE bid_reservations(agent_id INTEGER NOT NULL,problem_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(agent_id,problem_id));");
  this.raw.exec(readFileSync(new URL('../migrations/20261122_sprite_council_nonces.sql',import.meta.url),'utf8'));
  this.raw.prepare("INSERT INTO bid_reservations VALUES(1878,'3298',650,'uncertain')").run();
  this.raw.prepare("INSERT INTO bid_reservations VALUES(1878,'9951',750,'reserved')").run();
  this.raw.prepare("INSERT INTO sprite_council_nonce_consumption(nonce,agent_id,problem_id,amount_cents,intent_sha256,proposal_sha256,expires_at_sec) VALUES (?,1878,'9951',750,?, ?, ?)").run(nonce,hash,'b'.repeat(64),EXP);
 }
 prepare(sql){return {bind:(...params)=>({first:async()=>this.raw.prepare(sql).get(...params)??null})}}
 state(id){return this.raw.prepare('SELECT state FROM bid_reservations WHERE problem_id=?').get(id)?.state}
 count(sql){return this.raw.prepare(sql).get().n}
 close(){this.raw.close()}
}
const args=db=>({db,problemId:'9951',nonce,intentSha256:hash,nowSec:EXP+1});
test('REAL SQLITE: expired, never-claimed job safely releases ONE pending slot',async()=>{
 const db=new Stage();
 try{
  const r=await releaseExpiredNeverSentSpriteReservation(args(db));
  assert.equal(r.released,true);assert.equal(r.may_submit,false);
  assert.equal(db.state('9951'),'rejected');
  assert.equal(db.state('3298'),'uncertain');
  assert.equal(db.count("SELECT COUNT(*) n FROM sprite_council_nonce_consumption"),1);
  assert.equal(db.count("SELECT COUNT(*) n FROM bid_reservations WHERE problem_id<>'3298' AND state IN ('reserved','uncertain')"),0);
 }finally{db.close()}
});
test('REAL SQLITE: before expiry never release pending reservation',async()=>{
 const db=new Stage();
 try{
  const r=await releaseExpiredNeverSentSpriteReservation({...args(db),nowSec:EXP-1});
  assert.equal(r.released,false);assert.equal(db.state('9951'),'reserved');
 }finally{db.close()}
});
test('REAL SQLITE: exact expiry boundary may release never-sent reservation',async()=>{
 const db=new Stage();
 try{
  const r=await releaseExpiredNeverSentSpriteReservation({...args(db),nowSec:EXP});
  assert.equal(r.released,true);assert.equal(db.state('9951'),'rejected');
 }finally{db.close()}
});
test('REAL SQLITE: uncertain state NEVER released, including after deadline',async()=>{
 const db=new Stage();
 try{
  db.raw.prepare("UPDATE bid_reservations SET state='uncertain' WHERE problem_id='9951'").run();
  const r=await releaseExpiredNeverSentSpriteReservation(args(db));
  assert.equal(r.released,false);assert.equal(db.state('9951'),'uncertain');
 }finally{db.close()}
});
test('REAL SQLITE: submitted state is never rolled back',async()=>{
 const db=new Stage();
 try{
  db.raw.prepare("UPDATE bid_reservations SET state='submitted' WHERE problem_id='9951'").run();
  const r=await releaseExpiredNeverSentSpriteReservation(args(db));
  assert.equal(r.released,false);assert.equal(db.state('9951'),'submitted');
 }finally{db.close()}
});
test('REAL SQLITE: legacy #3298 cannot be touched, even when an unknown signature supplied',async()=>{
 const db=new Stage();
 try{
  const r=await releaseExpiredNeverSentSpriteReservation({...args(db),problemId:'3298'});
  assert.equal(r.released,false);assert.equal(db.state('3298'),'uncertain');
 }finally{db.close()}
});
test('REAL SQLITE: changed nonce is rejected and original not consumed twice',async()=>{
 const db=new Stage();
 try{
  const r=await releaseExpiredNeverSentSpriteReservation({...args(db),nonce:'e'.repeat(32)});
  assert.equal(r.released,false);assert.equal(db.state('9951'),'reserved');
 }finally{db.close()}
});
test('REAL SQLITE: changed signed intent is rejected',async()=>{
 const db=new Stage();
 try{
  const r=await releaseExpiredNeverSentSpriteReservation({...args(db),intentSha256:'e'.repeat(64)});
  assert.equal(r.released,false);assert.equal(db.state('9951'),'reserved');
 }finally{db.close()}
});
test('REAL SQLITE: 32 concurrent cancellation attempts can win at most once',async()=>{
 const db=new Stage();
 try{
  const results=await Promise.all(Array.from({length:32},()=>releaseExpiredNeverSentSpriteReservation(args(db))));
  assert.equal(results.filter(r=>r.released).length,1);
  assert.equal(db.state('9951'),'rejected');
  assert.equal(db.count("SELECT COUNT(*) n FROM sprite_council_nonce_consumption"),1);
 }finally{db.close()}
});
test('REAL SQLITE: altered quote prevents cancellation even with correct nonce',async()=>{
 const db=new Stage();
 try{
  db.raw.prepare("UPDATE bid_reservations SET amount_cents=751 WHERE problem_id='9951'").run();
  const r=await releaseExpiredNeverSentSpriteReservation(args(db));
  assert.equal(r.released,false);assert.equal(db.state('9951'),'reserved');
 }finally{db.close()}
});
test('REAL SQLITE: invalid clock, missing database, invalid task ID fail closed',async()=>{
 const db=new Stage();
 try{
  for(const x of [{db:null},{...args(db),nowSec:NaN},{...args(db),problemId:'not-an-id'}]){
    const r=await releaseExpiredNeverSentSpriteReservation(x);
    assert.equal(r.released,false);
  }
  assert.equal(db.state('9951'),'reserved');
 }finally{db.close()}
});
