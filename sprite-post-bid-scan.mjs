// Post-attempt diagnostics only. Preserve the original reservation result and never resend.
export async function reserveThenScan(reserve,scan,db,problemId,amountCents,send){
 let invoked=false;
 const wrapped=typeof send==="function"?async()=>{invoked=true;return await send();}:send;
 try{
  const result=await reserve(db,problemId,amountCents,wrapped);
  return result;
 }finally{
  if(invoked){try{await scan(problemId);}catch{/* Existing reservation remains authoritative. */}}
 }
}
