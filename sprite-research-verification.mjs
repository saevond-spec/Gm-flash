// Independently validate a bounded public research deliverable against the fetched source.
// No extra network calls, model calls, credentials or marketplace access.
export function verifyResearchReport(input,result){
 const fail=reason=>({passed:false,reason});
 try{
  const {countries,indicator,year}=input??{},r=result?.report,source=r?.source;
  if(!Array.isArray(countries)||countries.length<2||countries.length>5||new Set(countries).size!==countries.length||!countries.every(x=>/^[A-Z]{3}$/.test(x))||!Number.isSafeInteger(year)||typeof indicator!=="string"||source?.indicator!==indicator||typeof result.source_json!=="string"||result.source_json.length>131072)return fail("invalid_input");
  const parsed=JSON.parse(result.source_json),rows=parsed?.[1];
  if(!Array.isArray(parsed)||Number(parsed[0]?.pages)!==1||!Array.isArray(rows)||rows.length>countries.length)return fail("invalid_source");
  const index=Object.create(null);
  for(const row of rows){
   const key=row?.countryiso3code;
   if(!countries.includes(key)||Object.hasOwn(index,key)||row.indicator?.id!==indicator||String(row.date)!==String(year)||!(row.value===null||typeof row.value==="number"&&Number.isFinite(row.value)))return fail("source_identity_or_value");
   index[key]=row.value;
  }
  if(!Array.isArray(r.observations)||r.observations.length!==countries.length)return fail("observation_count");
  const observed=r.observations;
  let min=Infinity,max=-Infinity,available=0;
  for(let i=0;i<countries.length;i++){
   const o=observed[i],expected=Object.hasOwn(index,countries[i])?index[countries[i]]:null;
   if(o?.country!==countries[i]||o.year!==year||o.value!==expected)return fail("observation_mismatch");
   if(expected!==null){available++;min=Math.min(min,expected);max=Math.max(max,expected);}
  }
  const c=r.comparison;
  if(c?.available!==available||c.requested!==countries.length)return fail("coverage_mismatch");
  const extrema=(value)=>observed.filter(o=>o.value===value).map(o=>o.country).sort();
  const highest=available?extrema(max):[],lowest=available?extrema(min):[];
  const match=(x,ids,value)=>ids.length?x?.country===ids[0]&&x?.year===year&&x?.value===value:x===null;
  if(!match(c.highest,highest,max)||!(available?c.lowest?.country===lowest.at(-1)&&c.lowest?.year===year&&c.lowest?.value===min:c.lowest===null))return fail("extrema_mismatch");
  const spread=available>=2?max-min:null;
  if(c.spread!==spread||spread!==null&&!Number.isFinite(spread))return fail("spread_mismatch");
  const expectedCsv=["country,year,indicator,value",...countries.map((id,i)=>[id,year,indicator,observed[i].value??""].join(","))].join("\r\n")+"\r\n";
  if(result.csv!==expectedCsv)return fail("csv_mismatch");
  if(r.marketplace_submission!==false)return fail("unexpected_submission_claim");
  return {passed:true,method:"independent_source_row_and_comparison_check",coverage:available===countries.length?"complete":"partial",available,requested:countries.length,highest_ties:highest,lowest_ties:lowest,missing_countries:observed.filter(o=>o.value===null).map(o=>o.country),source_independence_verified:false,interpretation:"Validates arithmetic and consistency with retrieved source, not external truth or commercial demand."};
 }catch{return fail("verification_error");}
}
