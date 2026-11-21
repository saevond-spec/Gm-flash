const URL="https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods";
export async function fetchCanadaPopulation(year,fetcher=fetch){
 if(!Number.isInteger(year)||year<2000||year>new Date().getUTCFullYear())throw Error("Invalid year");
 const date=year+"-07-01";
 const request=[{vectorId:1,latestN:Math.min(120,(new Date().getUTCFullYear()-year+1)*4)}];
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),8000);
 try{
 const r=await fetcher(URL,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(request),redirect:"manual",signal:ac.signal});
 if(r.status!==200||!r.body)throw Error("Secondary source unavailable");
 const reader=r.body.getReader(),chunks=[];let n=0;
 for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>262144){await reader.cancel();throw Error("Source limit")};chunks.push(value)}
 const bytes=new Uint8Array(n);let p=0;for(const c of chunks){bytes.set(c,p);p+=c.length}
 const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes),data=JSON.parse(raw);
 const a=Array.isArray(data)&&data.length===1?data[0]:null,o=a?.object;
 if(a?.status!=="SUCCESS"||Number(o?.productId)!==17100009||Number(o?.vectorId)!==1||o?.coordinate!=="1.0.0.0.0.0.0.0.0.0"||!Array.isArray(o.vectorDataPoint))throw Error("Unexpected secondary source schema");
 const matches=o.vectorDataPoint.filter(x=>x.refPer===date);
 if(matches.length!==1)throw Error("Missing or duplicate reference date");
 const x=matches[0],value=Number(x.value);
 if(x.value===null||x.value===""||!Number.isSafeInteger(value)||value<=0||Number(x.scalarFactorCode)!==0)throw Error("Invalid population observation");
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
 return {publisher:"Statistics Canada",table:"17-10-0009-01",vector:1,reference_date:date,value,release_time:x.releaseTime??null,source_url:URL,request,sha256,retrieved_at:new Date().toISOString(),source_json:raw,source_independence_verified:false};
 }finally{clearTimeout(timer)}
}
