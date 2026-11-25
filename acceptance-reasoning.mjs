// General-purpose bounded exact reasoning for Sprite; no benchmark-specific answers.
const MAX=1000000000n;
const integer=s=>{if(!/^[+-]?\d{1,10}$/.test(s))throw Error("Invalid integer");const n=BigInt(s);if(n>MAX||n< -MAX)throw Error("Integer exceeds supported bounds");return n;};
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a;};
function prime(n){if(n<2n)return false;if(n%2n===0n)return n===2n;for(let d=3n;d*d<=n;d+=2n)if(n%d===0n)return false;return true;}
const result=(answer,reasoning)=>({answer,confidence:1,reasoning});
// Exact rational expression evaluator: bounded grammar, no dynamic code execution.
function rational(n,d=1n){
 if(!d)throw Error("Division by zero");
 if(n.toString().length>100||d.toString().length>100)throw Error("Magnitude bound");
 const g=gcd(n,d);const sign=d<0n?-1n:1n;return [n/g*sign,d/g*sign];
}
function expression(source){
 if(source.length>512||!/^[0-9+*×−\-/÷()\s]+$/.test(source))return null;
 const t=source.match(/\d+|[+*×−\-/÷()]/g)??[];
 if(t.length>128||!t.length)return null;
 let i=0;
 function atom(depth){
  if(depth>16)throw Error("Nesting bound");
  const x=t[i++];
  if(x==="+"||x==="-"||x==="−"){const [n,d]=atom(depth+1);return rational(x==="+"?n:-n,d);}
  if(x==="("){const a=add(depth+1);if(t[i++]!==")")throw Error("Unbalanced");return a;}
  return rational(integer(x??""));
 }
 function mul(depth){let [a,b]=atom(depth);while(["*","×","/","÷"].includes(t[i])){const op=t[i++];const [c,d]=atom(depth);[a,b]=op==="*"||op==="×"?rational(a*c,b*d):rational(a*d,b*c);}return [a,b];}
 function add(depth){let [a,b]=mul(depth);while(["+","-","−"].includes(t[i])){const op=t[i++];const [c,d]=mul(depth);[a,b]=rational(a*d+(op==="+"?1n:-1n)*b*c,b*d);}return [a,b];}
 const [n,d]=add(0);if(i!==t.length)throw Error("Unconsumed tokens");
 return result(d===1n?String(n):String(n)+"/"+String(d),"Evaluated the expression with exact rational arithmetic, parentheses and operator precedence.");
}
export function solveExactQuestion(question){
 if(typeof question!=="string"||question.length>2048)return null;
 const q=question.trim();let m;
 try{
  m=q.match(/^(?:what is|calculate|compute|evaluate)\s+(.+?)\s*\??$/i);
  if(m){const exact=expression(m[1]);if(exact)return exact;}
  m=q.match(/^(?:if a list has\s*|(?:find|what is)\s+(?:the\s+)?(?:maximum|minimum|sum)\s+of\s*)(\[[^\]]+\])(?:,?\s*what is the (maximum|minimum|sum)(?: value)?)?\s*\??$/i);
  if(m){const ops=[...q.matchAll(/\b(maximum|minimum|sum)\b/gi)].map(x=>x[1].toLowerCase());if(new Set(ops).size!==1)return null;const op=ops[0];const parts=m[1].slice(1,-1).split(",");if(!op||!parts.length||parts.length>128)return null;const values=parts.map(p=>integer(p.trim()));const n=op==="sum"?values.reduce((a,b)=>a+b,0n):values.reduce((a,b)=>op==="maximum"?(a>b?a:b):(a<b?a:b));return result(n.toString(),"Computed the "+op+" of every supplied integer.");}
  m=q.match(/^is\s+([+-]?\d+)\s+(?:a\s+)?prime(?: number)?\s*\?\s*(?:answer true or false\.?\s*)?$/i);
  if(m){const n=integer(m[1]);return result(String(prime(n)),"Checked integer divisors up to the square root, including the prime boundary cases.");}
 }catch{return null;}
 return null;
}
export function validateAcceptanceResponse(value){
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const {answer,confidence,reasoning}=value;
 if(typeof answer!=="string"||!answer.trim()||answer.length>4096||!Number.isFinite(confidence)||confidence<0||confidence>1||typeof reasoning!=="string"||!reasoning.trim()||reasoning.length>4096)return null;
 return {answer:answer.trim(),confidence,reasoning:reasoning.trim()};
}
