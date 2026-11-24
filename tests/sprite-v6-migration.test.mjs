import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../migrations/sprite-v6-readiness-submitting.sql',import.meta.url),'utf8');
function oldDb(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE autonomous_readiness (problem_id TEXT PRIMARY KEY,profile TEXT NOT NULL CHECK(profile IN ('csv_cleanup','arithmetic_reconciliation')),amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 500 AND 100000),hours INTEGER NOT NULL CHECK(hours BETWEEN 1 AND 168),cost_cents INTEGER NOT NULL CHECK(cost_cents=0),platform_limit_cents INTEGER NOT NULL CHECK(platform_limit_cents>=amount_cents),scope_verified INTEGER NOT NULL CHECK(scope_verified IN (0,1)),isolated_environment_verified INTEGER NOT NULL CHECK(isolated_environment_verified IN (0,1)),verified_at INTEGER NOT NULL,valid_until INTEGER NOT NULL CHECK(valid_until>verified_at AND valid_until<=verified_at+86400),rehearsal_passed INTEGER NOT NULL DEFAULT 0 CHECK(rehearsal_passed IN (0,1)));");
 db.exec("CREATE TABLE bid_reservations (agent_id INTEGER NOT NULL CHECK(agent_id=1878),problem_id TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 500 AND 10000000),state TEXT NOT NULL CHECK(state IN ('reserved','submitted','uncertain','rejected')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(agent_id,problem_id));");
 db.exec("CREATE TABLE sprite_reconciliation_events (agent_id INTEGER, problem_id TEXT,amount_cents INTEGER,event_type TEXT,outcome TEXT);");
 db.exec("CREATE TRIGGER sprite_reservation_update_audit AFTER UPDATE OF state ON bid_reservations WHEN NEW.agent_id=1878 AND OLD.state<>NEW.state BEGIN INSERT INTO sprite_reconciliation_events(agent_id,problem_id,amount_cents,event_type,outcome) VALUES(NEW.agent_id,NEW.problem_id,NEW.amount_cents,CASE WHEN NEW.state='submitted' THEN 'confirmed_submitted' ELSE 'operator_review' END,'reservation_state_'||substr(NEW.state,1,80)); END;");
 const now=Math.floor(Date.now()/1000);
 db.prepare("INSERT INTO autonomous_readiness VALUES('991001','csv_cleanup',2300,8,0,2500,1,1,?,?,1)").run(now,now+900);
 db.exec("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,'991099',650,'uncertain');");
 return db;
}
test('D1 migration preserves historical unknown reservation, verified readiness, original timestamp and audit',()=>{
 const db=oldDb(),before=db.prepare("SELECT * FROM bid_reservations WHERE problem_id='991099'").get();db.exec(migration);
 assert.deepEqual(db.prepare("SELECT * FROM bid_reservations WHERE problem_id='991099'").get(),before);
 assert.equal(db.prepare("SELECT profile FROM autonomous_readiness WHERE problem_id='991001'").get().profile,'csv_cleanup');
 assert.deepEqual(db.prepare('PRAGMA integrity_check').all(),[{integrity_check:'ok'}]);
});
test('new UAT readiness profile and SUBMITTING persist with original unique key',()=>{
 const db=oldDb();db.exec(migration);const now=Math.floor(Date.now()/1000);
 db.prepare("INSERT INTO autonomous_readiness VALUES('991002','uat_severity_policy',4700,48,0,5500,1,1,?,?,1)").run(now,now+3600);
 db.exec("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,'991002',4700,'reserved');");
 db.exec("UPDATE bid_reservations SET state='submitting' WHERE problem_id='991002';");
 assert.equal(db.prepare("SELECT state FROM bid_reservations WHERE problem_id='991002'").get().state,'submitting');
 assert.equal(db.prepare("SELECT outcome FROM sprite_reconciliation_events ORDER BY rowid DESC LIMIT 1").get().outcome,'reservation_state_submitting');
 assert.throws(()=>db.exec("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,'991002',4700,'reserved')"));
 assert.throws(()=>db.exec("UPDATE autonomous_readiness SET profile='unknown' WHERE problem_id='991002'"));
 assert.equal(db.prepare("SELECT state FROM bid_reservations WHERE problem_id='991099'").get().state,'uncertain');
});
test('legacy checks remain valid, migration rejects table schema tampering',()=>{
 const db=oldDb();db.exec(migration);
 assert.throws(()=>db.exec("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1744,'991003',4700,'reserved')"));
 assert.throws(()=>db.exec("INSERT INTO bid_reservations(agent_id,problem_id,amount_cents,state) VALUES(1878,'991004',4700,'garbage')"));
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
