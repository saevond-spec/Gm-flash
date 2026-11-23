import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyClawhuntGetProbe} from '../sprite-clawhunt-origin-probe.mjs';
import {diagnoseSpriteBid3298} from '../sprite-3298-readonly-diagnostic.mjs';
const req=(patch={})=>({
  method:'GET',path:'/api/v1/problems/3298/bids',httpStatus:403,
  responseText:'Forbidden: requests to clawhunt.store are not allowed',
  contentType:'text/plain;charset=UTF-8',
  finalUrl:'https://clawhunt.store/api/v1/problems/3298/bids',
  redirected:false,...patch
});
test('ORIGIN 403: control environment forbidden proxy does not count as marketplace authentication denial',()=>{
 const x=classifyClawhuntGetProbe(req());
 assert.equal(x.reason,'probe_environment_network_egress_blocked');
 assert.equal(x.upstream_auth_status,'not_observed');
 assert.equal(x.can_submit,false);assert.equal(x.may_resubmit,false);
});
test('ORIGIN 403: unknown normal 403 cannot prove agent rejection or missing bid',()=>{
 const x=classifyClawhuntGetProbe(req({responseText:'Forbidden'}));
 assert.equal(x.reason,'authenticated_origin_access_unverified');
 assert.equal(x.confirmed,false);assert.equal(x.may_resubmit,false);
});
test('ORIGIN 403: exact #3298 diagnostic reports environment denial, not marketplace authorization',()=>{
 const x=diagnoseSpriteBid3298({
  reservation:{problem_id:'3298',amount_cents:650,state:'uncertain'},
  authenticatedIdentity:{agent_id:1878,verified:true},
  taskDetail:{http_status:200,problem_id:'3298',bid_count:33},
  bidHistory:{http_status:403,probe_response:req()},
  outcomes:{http_status:200,record_count:1}
 });
 assert.equal(x.probes.find(p=>p.source==='bid_history').finding,
   'environment_egress_denied_not_clawhunt_auth');
 assert.equal(x.receipt_id,null);assert.equal(x.may_resubmit,false);
});
test('ORIGIN: a 200 JSON public response is never a trusted own-bid receipt',()=>{
 const x=classifyClawhuntGetProbe(req({httpStatus:200,responseText:'{"data":[]}',
  contentType:'application/json;charset=UTF-8'}));
 assert.equal(x.state,'json_candidate_only');
 assert.equal(x.source_authentic,false);
 assert.equal(x.confirmed,false);assert.equal(x.can_submit,false);
});
for(const patch of [
 {method:'POST'},
 {path:'/api/v1/problems/3298/bid'},
 {finalUrl:'https://evil.example/api/v1/problems/3298/bids'},
 {redirected:true},
 {httpStatus:200,contentType:'text/html'},
 {httpStatus:200,responseText:'{"ok":true}',contentType:'text/plain'},
 {httpStatus:500},
 {httpStatus:302},
 {httpStatus:0},
 {responseText:'\nForbidden: requests to clawhunt.store are not allowed\n',finalUrl:'http://clawhunt.store/api/v1/problems/3298/bids'}
])test('ORIGIN denies malformed, non-GET, or redirected transport facts '+JSON.stringify(patch),()=>{
 const x=classifyClawhuntGetProbe(req(patch));
 assert.equal(x.may_resubmit,false);assert.equal(x.can_submit,false);
 assert.notEqual(x.state,'json_candidate_only');
});
test('ORIGIN: 512 deterministic varied probe failures never become signed evidence',()=>{
 let seed=0x32982026;
 const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 const codes=[0,200,301,302,400,401,403,404,429,500,503];
 const paths=['/api/v1/problems/3298/bids','/api/v1/problems/3298/bid','/api/v1/bids/outcomes','/openapi.json'];
 for(let i=0;i<512;i++){
  const x=classifyClawhuntGetProbe(req({httpStatus:codes[rnd()%codes.length],
   path:paths[rnd()%paths.length],
   responseText:rnd()%2?'Forbidden: requests to clawhunt.store are not allowed':'bad request',
   contentType:rnd()%2?'text/plain':'application/json'}));
  assert.equal(x.confirmed,false);
  assert.equal(x.can_submit,false);assert.equal(x.may_resubmit,false);
  assert.equal(x.source_authentic,false);
 }
});
