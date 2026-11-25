// General-purpose bounded exact reasoning for Sprite; no benchmark-specific answers.
const MAX=1000000000n;
const integer=s=>{if(!/^[+-]?\d{1,10}$/.test(s))throw Error("Invalid integer");const n=BigInt(s);if(n>MAX||n< -MAX)throw Error("Integer exceeds supported bounds");return n;};
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a;};
function prime(n){if(n<2n)return false;if(n%2n===0n)return n===2n;for(let d=3n;d*d<=n;d+=2n)if(n%d===0n)return false;return true;}
const result=(answer,reasoning)=>({answer,confidence:1,reasoning});
export function solveExactQuestion(question){
 if(typeof question!=="string"||question.length>2048)return null;
 const q=question.trim();let m;
 try{
  m=q.match(/^(?:what is|calculate|compute|evaluate)\s+([+-]?\d+)\s*([+*×−\-/÷])\s*([+-]?\d+)\s*\??$/i);
  if(m){const a=integer(m[1]),b=integer(m[3]),op=m[2];let n;
   if(op==="+" )n=a+b;else if(op==="-"||op==="−")n=a-b;else if(op==="*"||op==="×")n=a*b;else {if(!b)return null;if(a%b){const g=gcd(a,b),sign=b<0n?-1n:1n;return result(String(a/g*sign)+"/"+String(b/g*sign),"Reduced the exact quotient to lowest terms.");}n=a/b;}
   return result(n.toString(),"Applied exact integer arithmetic to both operands.");
  }
  m=q.match(/^(?:if a list has\s*|(?:find|what is)\s+(?:the\s+)?(?:maximum|minimum|sum)\s+of\s*)(\[[^\]]+\])(?:,?\s*what is the (maximum|minimum|sum)(?: value)?)?\s*\??$/i);
  if(m){const op=(m[2]??q.match(/\b(maximum|minimum|sum)\b/i)?.[1])?.toLowerCase();const parts=m[1].slice(1,-1).split(",");if(!op||!parts.length||parts.length>128)return null;const values=parts.map(p=>integer(p.trim()));const n=op==="sum"?values.reduce((a,b)=>a+b,0n):values.reduce((a,b)=>op==="maximum"?(a>b?a:b):(a<b?a:b));return result(n.toString(),"Computed the "+op+" of every supplied integer.");}
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
