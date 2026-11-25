import {solveExactQuestion,validateAcceptanceResponse} from "./acceptance-reasoning.mjs";
// Deliberately narrow, independent verification for standalone integer questions.
// Unsupported syntax and contextual requests stay with the normal model pipeline.
const small=s=>/^[+-]?\d{1,7}$/.test(s)&&Math.abs(Number(s))<=1000000;
export function verifyStandaloneMath(question,solver=solveExactQuestion){
 if(typeof question!=="string"||question.length>1200)return null;
 const q=question.trim();let expected,valid,kind,m;
 if((m=q.match(/^(?:what is|calculate|compute|evaluate)\s+([+-]?\d+)\s*([+*×−\-/÷])\s*([+-]?\d+)\s*\??$/i))){
  if(!small(m[1])||!small(m[3]))return null;
  const a=Number(m[1]),b=Number(m[3]),op=m[2];
  kind="arithmetic";
  if(["/","÷"].includes(op)){
   if(!b)return null;
   valid=answer=>{const x=answer.match(/^(-?\d+)(?:\/([1-9]\d*))?$/);if(!x)return false;const n=Number(x[1]),d=Number(x[2]??1);return Number.isSafeInteger(n)&&Number.isSafeInteger(d)&&Math.abs(n)<=1000000&&d<=1000000&&n*b===a*d;};
  }else{expected=String(op==="+"?a+b:["*","×"].includes(op)?a*b:a-b);}
 }else if((m=q.match(/^(?:find|what is)\s+(?:the\s+)?(maximum|minimum|sum)\s+of\s*\[([^\]]+)\]\s*\??$/i))||(m=q.match(/^if a list has\s*\[([^\]]+)\],?\s*what is the (maximum|minimum|sum)(?: value)?\s*\??$/i))&& (m=[m[0],m[2],m[1]])){
  const op=m[1].toLowerCase(),parts=m[2].split(",").map(s=>s.trim());
  if(!parts.length||parts.length>128||parts.some(s=>!small(s)))return null;
  const xs=parts.map(Number).sort((a,b)=>a-b);
  if(op==="sum"){let total=0;for(let i=0;i<xs.length;i++)total+=xs[i];expected=String(total);}else expected=String(op==="maximum"?xs[xs.length-1]:xs[0]);
  kind="list";
 }else if((m=q.match(/^is\s+([+-]?\d+)\s+(?:a\s+)?prime(?: number)?\s*\?\s*(?:answer true or false\.?\s*)?$/i))){
  if(!small(m[1]))return null;const n=Number(m[1]);let prime=n>=2;
  for(let d=2;prime&&d<=Math.floor(Math.sqrt(n));d++)if(n%d===0)prime=false;
  expected=String(prime);kind="prime";
 }else return null;
 try{const result=validateAcceptanceResponse(solver(q));if(!result||!(valid?valid(result.answer):result.answer===expected))return null;return {answer:result.answer,kind,verification:"independent_numeric_check",inference:false};}catch{return null;}
}
