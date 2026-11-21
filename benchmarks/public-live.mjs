import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

const WORKER="https://gm-flash.saevond.workers.dev";
const MARKET="https://clawhunt.store";
const expectedHash="fcdeda7af6258cc1634a0ef9e23a8f808b9049cdcb9f2908fb8dc286cd8bf2b5";
const timeout=5500;
const results=[];
const record=(name,ok,details)=>{results.push({name,pass:!!ok,...details});console.log(JSON.stringify(results.at(-1)))};
async function fetchMeasured(url,opts={}){
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),timeout),start=performance.now();
  try{
    const response=await fetch(url,{...opts,signal:ac.signal,redirect:"manual",headers:{"User-Agent":"gm-flash-independent-benchmark/1.0 (+https://gm-flash.saevond.workers.dev)",...(opts.headers||{})}});
    const buffer=Buffer.from(await response.arrayBuffer());
    return {status:response.status,ms:+(performance.now()-start).toFixed(2),buffer,headers:response.headers};
  }finally{clearTimeout(t)}
}
const invoke=async(name,fn)=>{try{await fn()}catch(e){record(name,false,{error:String(e.message||e).slice(0,180)})}};
await invoke("real_clawhunt_public_file_sha256",async()=>{
  const x=await fetchMeasured(MARKET+"/api/v1/probe-files/test-file-v1.txt");
  const digest=createHash("sha256").update(x.buffer).digest("hex");
  record("real_clawhunt_public_file_sha256",x.status===200&&x.buffer.length===367&&digest===expectedHash,{http_status:x.status,byte_size:x.buffer.length,sha256:digest,ms:x.ms,expected_source:"ClawHunt official probe docs"});
});
await invoke("real_clawhunt_public_image_download",async()=>{
  const x=await fetchMeasured(MARKET+"/api/v1/probe-files/test-image-v1.png");
  const png=x.buffer.length>24&&x.buffer.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
  record("real_clawhunt_public_image_download",x.status===200&&png,{http_status:x.status,byte_size:x.buffer.length,png_magic:png,ms:x.ms,image_content_read:false});
});
const samples=[];
await invoke("production_health",async()=>{
  for(let i=0;i<12;i++){
    const x=await fetchMeasured(WORKER+"/health");
    const data=JSON.parse(x.buffer.toString("utf8"));
    samples.push(x.ms);
    if(x.status!==200||data.auto_bidding!==false||data.clawhunt_api_key_configured!==true||data.operator_configured!==true)
      throw Error("health abnormal http="+x.status+" booleans="+JSON.stringify({auto_bidding:data.auto_bidding,api_key_configured:data.clawhunt_api_key_configured,operator_configured:data.operator_configured}));
  }
  const xs=[...samples].sort((a,b)=>a-b);
  const pct=p=>xs[Math.ceil(xs.length*p)-1];
  record("production_health",true,{successes:samples.length,requests:samples.length,min_ms:xs[0],median_ms:pct(.5),p95_ms:pct(.95),max_ms:xs.at(-1),under_10_seconds:xs.at(-1)<10000});
});
await invoke("production_unauthorized_bid_denied",async()=>{
  const x=await fetchMeasured(WORKER+"/api/bid",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({problem_id:"123",amount_cents:10,message:"Never place an unauthorized bid",confirm:"PLACE_BID"})});
  record("production_unauthorized_bid_denied",x.status===401,{http_status:x.status,ms:x.ms,actual_bid_sent_to_clawhunt:false});
});
await invoke("production_unauthorized_identity_denied",async()=>{
  const x=await fetchMeasured(WORKER+"/api/connection");
  record("production_unauthorized_identity_denied",x.status===401,{http_status:x.status,ms:x.ms});
});
await invoke("production_unsigned_webhook_rejected",async()=>{
  const x=await fetchMeasured(WORKER+"/cph-webhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_type:"capability_probe",probe_type:"file_transfer",probe_id:"unauthorized-test"})});
  record("production_unsigned_webhook_rejected",x.status===401,{http_status:x.status,ms:x.ms,warning:x.status===503?"Signing secret unavailable; webhook blocked":"",safe_no_customer_content:true});
});
const passed=results.filter(x=>x.pass).length;
console.log("LIVE_BENCHMARK_SUMMARY",JSON.stringify({passed,total:results.length,failed:results.length-passed,kind:"public live read-only/non-authorized probes",signed_probes_not_run:true,ai_evaluation_not_run:true,real_bids_not_submitted:true}));
if(passed!==results.length)process.exitCode=1;
