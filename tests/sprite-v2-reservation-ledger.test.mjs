import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const schema=readFileSync(new URL('../migrations/sprite-v2-reservation-ledger.sql',import.meta.url),'utf8');
const evidence='a'.repeat(64),proposal='b'.repeat(64);
function setup({missing,job='999999991',amount=2500}={}){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');db.exec(schema);
 const nonce=randomUUID().replaceAll('-','').slice(0,32),now=Math.floor(Date.now()/1000);
 db.prepare('INSERT INTO sprite_v2_nonces VALUES (?,?,1878,?,NULL)').run(nonce,job,now+600);
 for(const role of ['mother','nova','operator'])if(role!==missing)db.prepare('INSERT INTO sprite_v2_approval_certificates VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),role,nonce,1878,job,amount,evidence,proposal,'key-'+role,'fictional-signature',now+300);
 const rid=randomUUID();
 const reserve=()=>db.prepare("INSERT INTO sprite_v2_reservations(reservation_id,problem_id,agent_id,amount_cents,evidence_hash,proposal_hash,nonce,approvals_expire_at) SELECT ?,?,1878,?,?,?, ?,MIN(expires_at) FROM sprite_v2_approval_certificates WHERE nonce=?").run(rid,job,amount,evidence,proposal,nonce,nonce);
 return {db,nonce,rid,job,amount,reserve};
}
const state=(db,id)=>db.prepare('SELECT state FROM sprite_v2_reservations WHERE reservation_id=?').get(id)?.state;
const move=(db,id,s)=>db.prepare('UPDATE sprite_v2_reservations SET state=?,updated_at=unixepoch() WHERE reservation_id=?').run(s,id);
test('one atomic reserve consumes nonce and maps all three approvals',()=>{const x=setup();x.reserve();assert.equal(x.db.prepare('SELECT COUNT(*) n FROM sprite_v2_reservation_approvals').get().n,3);assert.ok(x.db.prepare('SELECT consumed_at t FROM sprite_v2_nonces').get().t);});
test('missing independent operator signature record blocks reserve',()=>{const x=setup({missing:'operator'});assert.throws(x.reserve);assert.equal(x.db.prepare('SELECT consumed_at t FROM sprite_v2_nonces').get().t,null);});
test('duplicate active reservation leaves second nonce unconsumed',()=>{
 const x=setup();x.reserve();const n=randomUUID().replaceAll('-',''),now=Math.floor(Date.now()/1000);
 x.db.prepare('INSERT INTO sprite_v2_nonces VALUES (?,?,1878,?,NULL)').run(n,x.job,now+600);
 for(const role of ['mother','nova','operator'])x.db.prepare('INSERT INTO sprite_v2_approval_certificates VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),role,n,1878,x.job,x.amount,evidence,proposal,'key-'+role,'fictional-signature',now+300);
 assert.throws(()=>x.db.prepare('INSERT INTO sprite_v2_reservations(reservation_id,problem_id,agent_id,amount_cents,evidence_hash,proposal_hash,nonce,approvals_expire_at) VALUES (?,?,1878,?,?,?,?,?)').run(randomUUID(),x.job,x.amount,evidence,proposal,n,now+300));
 assert.equal(x.db.prepare('SELECT consumed_at t FROM sprite_v2_nonces WHERE nonce=?').get(n).t,null);
});
test('revocation before sending blocks RESERVED to SUBMITTING',()=>{const x=setup();x.reserve();const a=x.db.prepare('SELECT approval_id FROM sprite_v2_reservation_approvals LIMIT 1').get().approval_id;x.db.prepare('INSERT INTO sprite_v2_revocations(approval_id) VALUES (?)').run(a);assert.throws(()=>move(x.db,x.rid,'SUBMITTING'));assert.equal(state(x.db,x.rid),'RESERVED');});
test('cannot confirm without receipt or release an UNKNOWN send',()=>{const x=setup();x.reserve();move(x.db,x.rid,'SUBMITTING');assert.throws(()=>move(x.db,x.rid,'CONFIRMED'));move(x.db,x.rid,'UNKNOWN');assert.throws(()=>move(x.db,x.rid,'RELEASED_UNSENT'));});
test('valid confirmation requires real-format bid id and receipt hash',()=>{const x=setup();x.reserve();move(x.db,x.rid,'SUBMITTING');x.db.prepare("UPDATE sprite_v2_reservations SET state='CONFIRMED',bid_id='12345',resolution_evidence_hash=?,updated_at=unixepoch() WHERE reservation_id=?").run(evidence,x.rid);assert.equal(state(x.db,x.rid),'CONFIRMED');});
test('caller cannot backdate the database transition clock',()=>{const x=setup();x.reserve();assert.throws(()=>x.db.prepare("UPDATE sprite_v2_reservations SET state='SUBMITTING',updated_at=10 WHERE reservation_id=?").run(x.rid));});
test('nonce replay, core mutation and audit deletion fail',()=>{const x=setup();x.reserve();assert.throws(x.reserve);assert.throws(()=>x.db.prepare('UPDATE sprite_v2_reservations SET problem_id=?').run('777'));assert.throws(()=>x.db.exec('DELETE FROM sprite_v2_audit'));});
