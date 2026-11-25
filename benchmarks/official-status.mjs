// Read-only official Sprite benchmark diagnostics. No benchmark trigger or marketplace writes.
import {pathToFileURL} from "node:url";
export function summarizeOfficialProbe(envelope){
 if(envelope?.agent_id!==1878||envelope?.upstream_status!==200)throw Error("Sprite official status not verified");
 const raw=envelope.official_result;
 const root=raw?.data??raw;
 const breakdown=root?.scoring_breakdown;
 if(!breakdown||typeof breakdown!=="object")throw Error("Official scoring breakdown unavailable");
 const safeNumber=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max?v:null;
 const safeStatus=v=>["passed","failed","pending","running","never","success","error","completed"].includes(v)?v:null;
 const probes={};
 for(const name of ["file_transfer","visual_observation"]){
  const x=breakdown[name];
  if(!x||typeof x!=="object")continue;
  const score=safeNumber(x.score??x.total_score??x.total,0,100);
  const http=safeNumber(x.http_status,0,599);
  const latency=safeNumber(x.latency_ms??x.latency,0,600000);
  const details={};
  for(const key of ["http_200","valid_json","probe_id_match","probe_id","file_hash","content_preview","file_size","description","response_time","latency_score","visual_accuracy"]){
   const value=safeNumber(x[key],0,100);if(value!==null)details[key]=value;
  }
  probes[name]={score,http_status:http,reported_latency:latency,error_present:typeof x.error==="string"&&x.error.length>0,scoring_items:details,diagnosis:http!==null&&http!==200?"transport_or_http_failure":score!==null&&score<70?"inspect_scoring_items":"no_conclusion"};
 }
 if(!Object.keys(probes).length)throw Error("Official probe results missing");
 return {agent_id:1878,official_status:safeStatus(root.status??root.capability_probe_status),reported_score:safeNumber(root.score??root.benchmark_score??root.capability_benchmark_score,0,100),probes,benchmark_triggered:false};
}
export async function readOfficialStatus(token,fetcher=fetch){
 if(typeof token!=="string"||token.length<32||token.length>256)throw Error("Private Sprite operator token required");
 const response=await fetcher("https://gm-flash.saevond.workers.dev/api/benchmark-status",{method:"GET",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"x-control-token":token,Accept:"application/json","User-Agent":"sprite-benchmark-readonly/1.0"}});
 if(response.status!==200)throw Error("Official status request returned HTTP "+response.status);
 const reader=response.body?.getReader();if(!reader)throw Error("Empty status response");
 const decoder=new TextDecoder();let raw="",length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536)throw Error("Status response too large");raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
 return summarizeOfficialProbe(JSON.parse(raw));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await readOfficialStatus(process.env.SPRITE_CONTROL_TOKEN),null,2));}catch{console.error("Sprite benchmark status unavailable; verify authorization or inspect the private dashboard. No benchmark triggered.");process.exitCode=1;}
}
