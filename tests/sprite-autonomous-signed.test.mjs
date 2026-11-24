import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, generateKeyPairSync, sign as edSign, createHash } from 'node:crypto';
import { checkSignedBid } from '../sprite-autonomous-signed-v1.mjs';

const hash = x => createHash('sha256').update(x).digest('hex');
const b64 = b => Buffer.from(b).toString('base64');

function fixture(modify = () => {}) {
  const now = Math.floor(Date.now() / 1000);
  const id = '4199', amount = 2500, message = 'Relevance: specific CSV cleanup; acceptance verified by independent row counts.';
  const nonce = 'a'.repeat(32), evidence = hash('fictional-isolated-test'), proposal = hash(message);
  const pairs = ['mother','nova'].map(role => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const der = publicKey.export({ type: 'spki', format: 'der' });
    const row = {role,agent_id:1878,amount_cents:amount,issued_at:now-5,expires_at:now+180,nonce,evidence_digest:evidence,proposal_digest:proposal,consumed_at:null};
    const signatureMessage = () => ['sprite.autonomous.bid.v2','1878',id,String(amount),String(row.issued_at),String(row.expires_at),row.nonce,row.evidence_digest,row.proposal_digest].join('|');
    return {row,privateKey,signatureMessage,key:{role,key_id:hash(der),public_key_spki_pem:publicKey.export({type:'spki',format:'pem'})}};
  });
  modify(pairs);
  for (const p of pairs) p.row.signature_b64 = b64(edSign(null,Buffer.from(p.signatureMessage()),p.privateKey));
  let writes = 0;
  const db = { prepare(sql) { return {bind(){return this},async all(){
    if (sql.startsWith('SELECT role,agent_id')) return {results:pairs.map(x=>x.row)};
    if (sql.startsWith('SELECT role,key_id')) return {results:pairs.map(x=>x.key)};
    if (sql.startsWith('UPDATE')) {writes++;if (pairs.some(p=>p.row.consumed_at !== null)) return {results:[]};pairs.forEach(p=>p.row.consumed_at=now);return {results:pairs.map(p=>({role:p.row.role}))};}
    throw Error('unexpected SQL');}}}};
  return {env:{BID_LEDGER:db},id,amount,message,pairs,writes:()=>writes};
}

test('matching independent signatures pass and consume only once', async()=>{
  const x=fixture();assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message)).ok,true);
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,true);
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
  assert.equal(x.writes(),1);
});
test('mismatched separately signed nonces fail before consume', async()=>{
  const x=fixture(p=>{p[1].row.nonce='b'.repeat(32)});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
  assert.equal(x.writes(),0);
});
test('mismatched signed evidence fails', async()=>{
  const x=fixture(p=>{p[1].row.evidence_digest=hash('other')});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
  assert.equal(x.writes(),0);
});
test('expired council signature fails', async()=>{
  const x=fixture(p=>{p[1].row.expires_at=Math.floor(Date.now()/1000)-1});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
});
test('tampered proposal fails', async()=>{
  const x=fixture();assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message+' altered',true)).ok,false);
});
test('wrong agent identity fails', async()=>{
  const x=fixture(p=>{p[0].row.agent_id=1});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
});
test('missing independent approval fails', async()=>{
  const x=fixture(p=>{p.pop()});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
});
test('wrong key binding fails', async()=>{
  const x=fixture(p=>{p[0].key.key_id='0'.repeat(64)});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
});
test('bid below $20 floor fails', async()=>{
  const x=fixture();assert.equal((await checkSignedBid(x.env,x.id,1999,x.message,true)).ok,false);
});
test('unavailable ledger fails closed', async()=>{
  const x=fixture();assert.equal((await checkSignedBid({},x.id,x.amount,x.message,true)).ok,false);
});
test('duplicate role fails', async()=>{
  const x=fixture(p=>{p[1].row.role='mother'});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
});
test('mismatched signed amount fails', async()=>{
  const x=fixture(p=>{p[1].row.amount_cents=2600});
  assert.equal((await checkSignedBid(x.env,x.id,x.amount,x.message,true)).ok,false);
});
