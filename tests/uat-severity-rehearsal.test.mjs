import test from 'node:test';
import assert from 'node:assert/strict';
import {generateFictionalUatPolicy,verifyFictionalUatPolicy,LEVELS,priority} from '../uat-severity-rehearsal.mjs';
test('fictional UAT policy has four distinct severity levels and eight examples',()=>{
 const x=generateFictionalUatPolicy();
 assert.equal(verifyFictionalUatPolicy(x),true);
 assert.ok(x.fictional_only);assert.equal(x.samples.length,8);
 for(const l of LEVELS)assert.equal(x.samples.filter(c=>c.level===l).length,2);
});
test('corrupted UAT acceptance coverage is refused',()=>{
 const x=generateFictionalUatPolicy();
 assert.equal(verifyFictionalUatPolicy({...x,samples:x.samples.slice(1)}),false);
 assert.equal(verifyFictionalUatPolicy({...x,markdown:x.markdown.replace('## Critical','Missing')}),false);
 assert.equal(verifyFictionalUatPolicy({...x,markdown:x.markdown.replace('A2:','Missing')}),false);
});
test('25,000 deterministic UAT priority probes obey financial/privacy precedence',()=>{
 let x=0x9e3779b9;const rand=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x;};
 for(let i=0;i<25000;i++){
  const level=LEVELS[rand()%4],users=rand()%200,workaround=!!(rand()%2),risk=rand()%5===0,urgent=rand()%3===0;
  const p=priority(level,users,workaround,risk,urgent);
  assert.ok(['P0','P1','P2','P3'].includes(p));
  if(risk||level==='Blocker')assert.equal(p,'P0');
  if(level==='Critical'&&!workaround)assert.equal(p,'P0');
 }
});
