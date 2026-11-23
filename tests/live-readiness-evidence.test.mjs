import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {assessSpriteBidReadiness,requiredSpriteBidChecks} from '../sprite-readiness-gate.mjs';

test('SIMULATION certification never certifies real bids from passing tests alone',()=>{
  const result=assessSpriteBidReadiness({synthetic_ci_passed:true,sqlite_real_transaction_passed:true,legacy_3298_quarantined:true});
  assert.equal(result.state,'hold_unverified');
  assert.equal(result.may_submit,false);
  assert.ok(result.blockers.some(b=>b.id==='nova_authorized_release_verified'));
  assert.ok(result.blockers.some(b=>b.id==='receipt_reconciliation_verified'));
});
test('SIMULATION every reported evidence boolean stays advisory and cannot enable a marketplace write',()=>{
  const all=Object.fromEntries(requiredSpriteBidChecks.map(({id})=>[id,true]));
  const result=assessSpriteBidReadiness({...all,legacy_3298_quarantined:true});
  assert.equal(result.state,'eligible_for_separately_approved_live_canary');
  assert.equal(result.may_submit,false);assert.equal(result.automatic_submission_enabled,false);
  assert.equal(result.blockers.length,0);
});
test('SIMULATION malformed evidence cannot promote readiness',()=>{
  for(const value of ['true',1,{},null,false]) {
    const full=Object.fromEntries(requiredSpriteBidChecks.map(({id})=>[id,true]));
    full.nova_authorized_release_verified=value;
    const state=assessSpriteBidReadiness({...full,legacy_3298_quarantined:true});
    assert.equal(state.state,'hold_unverified');assert.equal(state.may_submit,false);
  }
});
test('SIMULATION omitted legacy reservation quarantine blocks certification',()=>{
 const complete=Object.fromEntries(requiredSpriteBidChecks.map(({id})=>[id,true]));
 const state=assessSpriteBidReadiness(complete);
 assert.equal(state.state,'hold_unverified');
 assert.ok(state.blockers.some(x=>x.id==='legacy_3298_quarantined'));
});
test('SQLITE: conflict rolls back nonce as well as reservation, not only the JS mock',()=>{
 const d=new DatabaseSync(':memory:');
 try {
   d.exec("CREATE TABLE reservations(id TEXT PRIMARY KEY,state TEXT);CREATE TABLE tokens(nonce TEXT PRIMARY KEY,task TEXT);");
   d.prepare("INSERT INTO reservations VALUES(?,?)").run('first','uncertain');
   const attempt=(id,nonce)=>{
     d.exec('BEGIN IMMEDIATE');
     try{
       const r=d.prepare("INSERT INTO reservations(id,state) SELECT ?,'reserved' WHERE NOT EXISTS(SELECT 1 FROM reservations WHERE id<>'first' AND state IN ('reserved','uncertain')) ON CONFLICT(id) DO NOTHING RETURNING id").all(id);
       const n=d.prepare("INSERT INTO tokens(nonce,task) SELECT ?,? WHERE changes()=1 RETURNING nonce").all(nonce,id);
       if(r.length!==1||n.length!==1){d.exec('ROLLBACK');return false;}
       d.exec('COMMIT');return true;
     }catch(e){d.exec('ROLLBACK');return false;}
   };
   assert.equal(attempt('second','nonce-1'),true);
   assert.equal(attempt('third','nonce-2'),false);
   assert.equal(d.prepare("SELECT COUNT(*) as n FROM tokens").get().n,1);
   assert.equal(d.prepare("SELECT COUNT(*) as n FROM reservations").get().n,2);
 }finally{d.close();}
});
test('SQLITE: exactly-once claim survives an interrupted sender and any rerun',()=>{
 const d=new DatabaseSync(':memory:');
 try{
   d.exec("CREATE TABLE reservations(id TEXT PRIMARY KEY,state TEXT);CREATE TABLE claims(nonce TEXT PRIMARY KEY,task TEXT,hash TEXT);");
   const h=createHash('sha256').update('FICTIONAL signed intent').digest('hex');
   d.prepare("INSERT INTO reservations VALUES(?,'reserved')").run('9001');
   d.prepare("INSERT INTO claims VALUES(?,?,?)").run('nonce','9001',h);
   const claim=()=>d.prepare("UPDATE reservations SET state='uncertain' WHERE id=? AND state='reserved' AND EXISTS(SELECT 1 FROM claims WHERE nonce=? AND task=? AND hash=?) RETURNING id").all('9001','nonce','9001',h);
   assert.equal(claim().length,1);
   assert.equal(claim().length,0);
   assert.equal(d.prepare("SELECT state FROM reservations WHERE id='9001'").get().state,'uncertain');
 }finally{d.close();}
});
