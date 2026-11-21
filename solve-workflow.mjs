import {buildDataDelivery} from "./data-delivery.mjs";
import {reconcile} from "./bid-solve.mjs";
const own=(o,k)=>Object.hasOwn(o,k);
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const keys=(o,allowed)=>object(o)&&Object.keys(o).every(k=>allowed.includes(k));
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
// Independent strict decoder for the quoted CSV dialect used by the exporter.
export function parseQuotedCsv(csv){
 if(typeof csv!=="string"||csv.length>131072)throw Error("Invalid CSV");
 let i=0,rows=[];
 while(i<csv.length){
  const row=[];
  for(;;){
   if(csv[i++]!=='"')throw Error("Missing quoted field");
   let value="",closed=false;
   while(i<csv.length){
    const ch=csv[i++];
    if(ch!=='"'){value+=ch;continue}
    if(csv[i]==='"'){value+='"';i++;continue}
    closed=true;break;
   }
   if(!closed)throw Error("Unclosed field");
   row.push(value);
   if(csv[i]===","){i++;continue}
   if(csv.slice(i,i+2)!=="\r\n")throw Error("Missing CRLF");
   i+=2;break;
  }
  rows.push(row);
 }
 if(!rows.length||rows.some(r=>r.length!==rows[0].length))throw Error("Invalid row width");
 return rows;
}
export function verifyCsvFields(csv,columns,uniqueRows){
 // Separate implementation of the documented export policy, not exporter helpers.
 const expected=[columns,...uniqueRows.map(row=>columns.map(c=>{
  const v=row[c];
  if(v===null)return "";
  if(typeof v!=="string")return String(v);
  const first=v.trimStart()[0];
  return ["=","+","-","@"].includes(first)||["\t","\r","\n"].includes(v[0])?"'"+v:v;
 }))];
 try{
 const actual=parseQuotedCsv(csv);
 let matches=0;for(let i=0;i<expected.length;i++)for(let j=0;j<expected[i].length;j++)if(actual[i]?.[j]===expected[i][j])matches++;
 const count=expected.reduce((n,r)=>n+r.length,0);
 return {expected:count,actual:matches,pass:matches===count&&actual.length===expected.length&&actual.every(r=>r.length===columns.length)};
 }catch{return {expected:expected.reduce((n,r)=>n+r.length,0),actual:0,pass:false}}
}

// Closed declarative workflow; no arbitrary code or URL execution.
export async function solveWorkflow(input){
 if(!keys(input,["source_kind","confirm_no_customer_data","columns","rows","reconciliation","acceptance"])||!["fictional","public"].includes(input.source_kind)||input.confirm_no_customer_data!==true)throw Error("Only declared public or fictional inputs");
 const a=input.acceptance,r=input.reconciliation;
 if(!keys(a,["expected_unique_rows","expected_duplicates","expected_total_cents","require_balance"])||
 !Number.isSafeInteger(a.expected_unique_rows)||a.expected_unique_rows<1||a.expected_unique_rows>500||
 !Number.isSafeInteger(a.expected_duplicates)||a.expected_duplicates<0||a.expected_duplicates>499||
 !Number.isSafeInteger(a.expected_total_cents)||typeof a.require_balance!=="boolean")throw Error("Explicit acceptance criteria required");
 if(!keys(r,["column","declared_total_cents"])||typeof r.column!=="string"||!Array.isArray(input.columns)||!input.columns.includes(r.column)||!Number.isSafeInteger(r.declared_total_cents))throw Error("Invalid reconciliation settings");
 const delivery=await buildDataDelivery({source_kind:input.source_kind,confirm_no_customer_data:true,columns:input.columns,rows:input.rows});
 const unique=new Map();
 for(const row of input.rows){const k=JSON.stringify(input.columns.map(c=>row[c]));if(!unique.has(k))unique.set(k,row)}
 const values=[...unique.values()].map(row=>row[r.column]);
 if(values.some(v=>!Number.isSafeInteger(v)))throw Error("Reconciliation requires integer cents; no coercion");
 const balance=reconcile(values,r.declared_total_cents);
 const independentTotal=values.reduce((sum,v)=>sum+BigInt(v),0n);
 const checks=[
  {id:"unique_rows",expected:a.expected_unique_rows,actual:delivery.manifest.rows_out,pass:delivery.manifest.rows_out===a.expected_unique_rows},
  {id:"duplicates",expected:a.expected_duplicates,actual:delivery.manifest.duplicates_removed,pass:delivery.manifest.duplicates_removed===a.expected_duplicates},
  {id:"total_cents",expected:a.expected_total_cents,actual:balance.total_cents,pass:balance.total_cents===a.expected_total_cents},
  {id:"exact_arithmetic",expected:String(independentTotal),actual:String(balance.total_cents),pass:independentTotal===BigInt(balance.total_cents)},
  {id:"row_conservation",expected:input.rows.length,actual:delivery.manifest.rows_out+delivery.manifest.duplicates_removed,pass:input.rows.length===delivery.manifest.rows_out+delivery.manifest.duplicates_removed},
  {id:"balance",expected:a.require_balance?"matched":"not_required",actual:balance.matched?"matched":"unmatched",pass:!a.require_balance||balance.matched},
  {id:"artifact_integrity",expected:delivery.manifest.sha256,actual:await hash(delivery.csv)}
 ];
 checks.at(-1).pass=checks.at(-1).expected===checks.at(-1).actual;
 checks.push({id:"csv_field_roundtrip",...verifyCsvFields(delivery.csv,input.columns,[...unique.values()])});
 const passed=checks.every(c=>c.pass);
 const evidence={schema:"sprite.workflow.v2",source_kind:input.source_kind,source_origin_verified:false,steps:["validate","deduplicate","reconcile","verify"],checks,passed,customer_acceptance_verified:false,marketplace_submission:false,limitations:["Acceptance criteria supplied by operator, not independently certified by a buyer.","Arithmetic cross-check uses deduplicated original typed rows.","CSV does not preserve original scalar types."]};
 const artifact={csv:delivery.csv,manifest:delivery.manifest,reconciliation:balance,evidence};
 return {...artifact,release_status:passed?"eligible_for_operator_review":"blocked_by_failed_acceptance",evidence_sha256:await hash(JSON.stringify(evidence))};
}
