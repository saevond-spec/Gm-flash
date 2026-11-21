import { fetchCanadaPopulation } from "./statcan-live.mjs";
import { corroboratePopulation } from "./source-corroboration.mjs";
// Independent Sprite public research engine. Only fixed World Bank API endpoints.
// No AI conclusions, arbitrary URLs, marketplace credentials, customer input, or Star access.
const COUNTRIES=new Set(["USA","CAN","GBR","DEU","FRA","JPN","AUS","IND","BRA","MEX","KOR","IDN"]);
const INDICATORS=Object.freeze({"NY.GDP.PCAP.CD":"GDP per capita (current US$)","SP.POP.TOTL":"Population, total","NY.GDP.MKTP.CD":"GDP (current US$)","NY.GDP.MKTP.KD.ZG":"GDP growth (annual %)"});
const enc=new TextEncoder();
async function sha(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("")}
export async function buildResearch(body,fetcher=fetch){
  if(!body||Object.keys(body).some(k=>!["countries","indicator","year"].includes(k)))throw Error("Unsupported request fields");
  const {countries,indicator,year}=body;
  if(!Array.isArray(countries)||countries.length<2||countries.length>5||new Set(countries).size!==countries.length||countries.some(c=>!COUNTRIES.has(c)))throw Error("Select 2–5 distinct supported country codes");
  if(!Object.hasOwn(INDICATORS,indicator)||!Number.isSafeInteger(year)||year<2000||year>new Date().getUTCFullYear()-1)throw Error("Unsupported indicator or year");
  const url="https://api.worldbank.org/v2/country/"+countries.join(";")+"/indicator/"+indicator+"?date="+year+"&format=json&per_page=100&source=2";
  const start=Date.now(),ac=new AbortController(),timer=setTimeout(()=>ac.abort(),9000);
  try{
    const r=await fetcher(url,{method:"GET",redirect:"manual",signal:ac.signal,headers:{"Accept":"application/json"}});
    if(r.status!==200||!r.body)throw Error("Source not available");
    const reader=r.body.getReader(),chunks=[];let n=0;
    for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>131072){await reader.cancel();throw Error("Source response too large")}chunks.push(value)}
    const raw=new Uint8Array(n);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.byteLength}
    const data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw));
    if(!Array.isArray(data)||!Array.isArray(data[1])||Number(data[0]?.pages)!==1)throw Error("Incomplete or unknown source schema");
    const indexed=new Map();
    for(const row of data[1]){
      const id=row?.countryiso3code;
      if(!countries.includes(id)||row?.indicator?.id!==indicator||String(row.date)!==String(year)||indexed.has(id))throw Error("Unexpected or duplicate source observation");
      if(row.value!==null&&(typeof row.value!=="number"||!Number.isFinite(row.value)))throw Error("Unexpected observation value");
      indexed.set(id,{country:id,year,value:row.value,observation_status:typeof row.obs_status==="string"?row.obs_status.slice(0,8):""});
    }
    const observations=countries.map(c=>indexed.get(c)??{country:c,year,value:null,observation_status:"missing"});
    const available=observations.filter(o=>o.value!==null).sort((a,b)=>b.value-a.value || a.country.localeCompare(b.country));
    const source={publisher:"World Bank, World Development Indicators (source 2)",url,indicator,indicator_label:INDICATORS[indicator],retrieved_at:new Date().toISOString(),sha256:await sha(raw),byte_size:n,source_updated:data[0]?.lastupdated??null};
    const report={source,observations,comparison:{available:available.length,requested:countries.length,highest:available[0]??null,lowest:available.at(-1)??null,spread:available.length>=2?available[0].value-available.at(-1).value:null},limitations:["Single public source, not independently corroborated.","Same indicator and year only; missing observations are not imputed.","Current-dollar GDP measures are nominal, not purchasing-power adjusted; economic indicators alone do not establish commercial demand."],marketplace_submission:false};
    report.corroboration=corroboratePopulation(report);
    if(indicator==="SP.POP.TOTL"&&countries.includes("CAN")){
      try {
        const secondary=await fetchCanadaPopulation(year,fetcher);
        const primary=observations.find(o=>o.country==="CAN")?.value;
        const delta=typeof primary==="number"?primary-secondary.value:null;
        report.live_secondary={status:"retrieved",...secondary,primary_value:primary,delta_persons:delta,absolute_relative_difference:delta===null?null:Math.abs(delta)/secondary.value,review_threshold:0.01,review_status:delta===null?"missing_primary":Math.abs(delta)/secondary.value<=0.01?"within_review_threshold":"needs_review",limitations:["Shared upstream national data is possible.","Reference dates and revisions may differ; agreement is not independent validation."]};
      }catch{report.live_secondary={status:"unavailable",publisher:"Statistics Canada",reason:"Live source validation or retrieval failed; no live reference substituted"};}
    }
    const csv="country,year,indicator,value\r\n"+observations.map(o=>[o.country,o.year,indicator,o.value===null?"":o.value].join(",")).join("\r\n")+"\r\n";
    return {report,csv,source_json:new TextDecoder().decode(raw),csv_sha256:await sha(enc.encode(csv)),retrieval_ms:Date.now()-start};
  }finally{clearTimeout(timer)}
}
