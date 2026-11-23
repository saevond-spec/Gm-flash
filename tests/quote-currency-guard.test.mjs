import test from "node:test";
import assert from "node:assert/strict";
import {qualifyTask} from "../worker.mjs";
const base={id:123,status:"open",currency:"USD",escrow_status:"held",budget_cents:700};
const cases=[
 [base,500,false,true],
 [{...base,currency:"EUR"},500,false,false],
 [{...base,currency:undefined},500,false,false],
 [{...base,currency:"USD",is_simulated:true},500,false,false],
 [base,499,false,false],
 [base,701,false,false],
 [{...base,escrow_status:"none"},500,true,true],
 [{...base,escrow_status:"none",currency:"EUR"},500,true,false],
 [{...base,escrow_status:"none",currency:undefined},500,true,false],
 [{...base,escrow_status:"none"},499,true,false],
 [base,500.5,false,false],
 [{...base,escrow_status:"held",funded:false},500,false,true],
];
for(const [i,[task,quote,optional,expected]] of cases.entries())test("currency and quote gate "+i,()=>assert.equal(qualifyTask(task,"123",quote,optional).eligible,expected));
