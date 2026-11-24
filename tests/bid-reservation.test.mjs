import test from 'node:test';
import assert from 'node:assert/strict';
import {submitWithReservation} from '../bid-reservation.mjs';
function fixture({failTransition=false,failUnknown=false,failBatch=false}={}){
 const rows=new Map(),receipts=new Map();
 const api={
  rows,receipts,
  prepare(sql){
   return {bind(...args){return {
    async first(){
     if(sql.startsWith('INSERT INTO bid_reservations')){
      const [id,amount]=args;if(rows.has(id))return null;
      rows.set(id,{amount,state:'reserved'});return {problem_id:id};
     }
     if(sql.includes("SET state='submitting'")){
      if(failTransition)throw Error('D1 unavailable');
      const [id,amount]=args,r=rows.get(id);
      if(!r||r.amount!==amount||r.state!=='reserved')return null;
      r.state='submitting';return {problem_id:id};
     }
     if(sql.startsWith('SELECT state')){
      const [id]=args;return rows.get(id)?{state:rows.get(id).state}:null;
     }
     throw Error('Unexpected first SQL '+sql.slice(0,90));
    },
    async run(){
     if(sql.includes("SET state='uncertain'")){
      if(failUnknown)throw Error('D1 uncertain update unavailable');
      const [id]=args,r=rows.get(id);
      if(r?.state==='submitting')r.state='uncertain';
      return {success:true};
     }
     throw Error('Unexpected run SQL '+sql.slice(0,90));
    }
   }}};
  },
  async batch(stmts){
   if(failBatch)throw Error('D1 batch failure');
   const a=stmts[0],b=stmts[1];
   // The fixture uses the prepared SQL objects with bound arguments.
   if(!a||!b)throw Error('Missing statements');
   const receipt=a.args,update=b.args;
   if(receipt?.length!==4||update?.length!==5)throw Error('Unexpected receipt args');
   const [id,bid,amount]=receipt, r=rows.get(id);
   if(r?.state==='submitting'&&r.amount===amount){
    receipts.set(id,{bid,amount});
    if(update[0]===id&&update[1]===amount&&update[2]===id&&update[3]===bid&&update[4]===amount){
     r.state='submitted';
    }
   }
  }
 };
 // Adapt query builders for batch-bound statement inspection.
 const original=api.prepare.bind(api);
 api.prepare=(sql)=>{
  const x=original(sql);
  if(sql.startsWith('INSERT INTO sprite_bid_receipts')||sql.includes("SET state='submitted'")){
   return {bind(...args){return {sql,args}}};
  }
  return x;
 };
 return api;
}
const validReceipt=(amount=2000)=>({ok:true,status:200,data:{success:true,data:{bid:{id:712345,problem_id:123,agent:{id:1878},estimated_cost:amount,status:'pending'}}}});
test('64 competing sends reserve once, enter SUBMITTING before outbound call, then UNKNOWN without receipt',async()=>{
 const db=fixture(),sentStates=[];
 const out=await Promise.all(Array.from({length:64},()=>submitWithReservation(db,'123',2000,async()=>{
  sentStates.push(db.rows.get('123').state);return {ok:true,status:200,data:{success:true}};
 })));
 assert.deepEqual(sentStates,['submitting']);
 assert.equal(out.filter(x=>x.attempted).length,1);
 assert.equal(out.filter(x=>x.http_status===409).length,63);
 assert.equal(db.rows.get('123').state,'uncertain');
});
test('pre-send D1 transition failure prohibits network send and the reservation stays quarantined',async()=>{
 const db=fixture({failTransition:true});let sent=0;
 const o=await submitWithReservation(db,'123',2000,async()=>{sent++});
 assert.equal(o.attempted,false);assert.equal(o.state,'pre_send_ledger_unavailable');
 assert.equal(sent,0);assert.equal(db.rows.get('123').state,'reserved');
 assert.equal((await submitWithReservation(db,'123',2000,async()=>{sent++})).attempted,false);
});
test('transport exception and unavailable UNKNOWN update keep same-task retry blocked',async()=>{
 const db=fixture({failUnknown:true});let count=0;
 const o=await submitWithReservation(db,'123',2000,async()=>{count++;throw Error('timeout')});
 assert.equal(o.attempted,true);assert.equal(o.state,'uncertain');
 assert.equal(db.rows.get('123').state,'submitting');
 assert.equal((await submitWithReservation(db,'123',2000,async()=>{count++})).attempted,false);
 assert.equal(count,1);
});
test('authoritative exact receipt confirms only matching task/agent/price, no blind success from HTTP 200',async()=>{
 const yes=fixture();
 const o=await submitWithReservation(yes,'123',2000,async()=>validReceipt());
 assert.equal(o.state,'submitted');assert.equal(o.bid_id,'712345');
 assert.equal(yes.rows.get('123').state,'submitted');
 const wrong=fixture();
 const no=await submitWithReservation(wrong,'123',2000,async()=>validReceipt(2001));
 assert.equal(no.state,'uncertain');assert.equal(wrong.rows.get('123').state,'uncertain');
});
test('invalid bounds, no ledger and corrupt D1 fail before any network call',async()=>{
 let sends=0;const send=async()=>{sends++};
 for(const db of [null,{prepare(){throw Error('unavailable')}}])
   assert.equal((await submitWithReservation(db,'123',2000,send)).attempted,false);
 for(const amount of [1999,10000001,NaN,2000.5])
   assert.equal((await submitWithReservation(fixture(),'123',amount,send)).attempted,false);
 assert.equal(sends,0);
});
