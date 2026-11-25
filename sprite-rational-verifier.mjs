// Independent stack-based rational evaluator. Separate algorithm from recursive descent.
export function verifyCompoundMath(question,solver){
 if(typeof question!=="string"||question.length>512||typeof solver!=="function")return null;
 const m=question.trim().match(/^(?:calculate|compute|evaluate|what is)\s+([0-9+*/×÷−()\s-]+?)\s*\??$/i);
 if(!m)return null;
 const tokens=m[1].match(/\d+|[+*/×÷−()-]/g)??[];
 if(!tokens.length||tokens.length>128)return null;
 const vals=[],ops=[];
 let needValue=true,depth=0;
 const prec={"+":1,"-":1,"*":2,"/":2,"u+":3,"u-":3};
 const abs=n=>n<0n?-n:n;
 const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b){const t=a%b;a=b;b=t;}return a;};
 const reduce=(n,d)=>{if(!d||abs(n).toString().length>100||abs(d).toString().length>100)throw Error("bounds");const g=gcd(n,d),s=d<0n?-1n:1n;return [s*n/g,s*d/g];};
 function apply(){
  const op=ops.pop();if(op==="u+"||op==="u-"){if(!vals.length)throw Error("operand");const [n,d]=vals.pop();vals.push([op==="u-"?-n:n,d]);return;}
  if(vals.length<2||!prec[op])throw Error("operand");const [b,e]=vals.pop(),[a,d]=vals.pop();
  vals.push(op==="+"?reduce(a*e+b*d,d*e):op==="-"?reduce(a*e-b*d,d*e):op==="*"?reduce(a*b,d*e):reduce(a*e,d*b));
 }
 try{
  for(let t of tokens){
   t=t==="×"?"*":t==="÷"?"/":t==="−"?"-":t;
   if(/^\d+$/.test(t)){if(!needValue||t.length>10||BigInt(t)>1000000000n)return null;vals.push([BigInt(t),1n]);needValue=false;continue;}
   if(t==="("){if(!needValue||++depth>16)return null;ops.push(t);continue;}
   if(t===")"){if(needValue||depth<=0)return null;while(ops.length&&ops.at(-1)!=="(")apply();if(ops.pop()!=="(")return null;depth--;continue;}
   if(needValue){if(t!=="+"&&t!=="-")return null;ops.push("u"+t);continue;}
   while(ops.length&&ops.at(-1)!=="("&&prec[ops.at(-1)]>=prec[t])apply();ops.push(t);needValue=true;
  }
  if(needValue||depth)return null;while(ops.length)apply();if(vals.length!==1)return null;
  const [n,d]=vals[0];const answer=d===1n?String(n):String(n)+"/"+String(d);
  const candidate=solver(question);
  if(candidate?.answer!==answer)return null;
  return {answer,kind:"arithmetic",verification:"independent_rational_stack_check",inference:false};
 }catch{return null;}
}
