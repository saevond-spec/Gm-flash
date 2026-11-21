// Fictional-only research prototype. Accept only parsed JSON data, never live objects or arbitrary code.
// This is an application-level restricted interpreter, not an infrastructure sandbox.
export function runBoundedJob(job){
  const fail=reason=>({ok:false,reason});
  if(!job||Object.getPrototypeOf(job)!==Object.prototype||Object.keys(job).sort().join(",")!=="instructions,job_id"||typeof job.job_id!=="string"||!/^[1-9][0-9]{0,9}$/.test(job.job_id)||!Array.isArray(job.instructions)||job.instructions.length<1||job.instructions.length>64)return fail("schema");
  const stack=[];
  const limit=1000000000n;
  for(const tuple of job.instructions){
    if(!Array.isArray(tuple)||typeof tuple[0]!=="string")return fail("instruction");
    const op=tuple[0];
    if(op==="push"){
      if(tuple.length!==2||!Number.isSafeInteger(tuple[1])||Math.abs(tuple[1])>1000000000)return fail("operand");
      if(stack.length>=32)return fail("stack_limit");
      stack.push(BigInt(tuple[1]));
      continue;
    }
    if(tuple.length!==1||!(op==="add"||op==="subtract"||op==="multiply")||stack.length<2)return fail("capability_or_stack");
    const b=stack.pop(),a=stack.pop();
    const v=op==="add"?a+b:op==="subtract"?a-b:a*b;
    if(v>limit||v< -limit)return fail("range");
    stack.push(v);
  }
  if(stack.length!==1)return fail("result_shape");
  return {ok:true,job_id:job.job_id,value:Number(stack[0]),instructions_executed:job.instructions.length};
}
