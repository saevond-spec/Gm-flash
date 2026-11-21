// Human-reviewed public reference snapshots, not live API responses.
// National series may share source data with World Bank WDI; this is cross-publisher agreement, not statistically independent confirmation.
export const REFERENCE_2024=Object.freeze({
 USA:Object.freeze({value:340110988,reference_date:"2024-07-01",publisher:"U.S. Census Bureau",vintage:"V2024",url:"https://www.census.gov/quickfacts/fact/table/US/PST040222"}),
 CAN:Object.freeze({value:41162593,reference_date:"2024-07-01",publisher:"Statistics Canada",vintage:"2026-09-23 release",url:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000501"}),
 JPN:Object.freeze({value:123802000,reference_date:"2024-10-01",publisher:"Statistics Bureau of Japan",vintage:"2024 annual estimate",url:"https://www.stat.go.jp/english/data/jinsui/2024np/index.html"})
});
export function corroboratePopulation(report){
 if(report?.source?.indicator!=="SP.POP.TOTL")return null;
 const observations=report.observations;
 if(!Array.isArray(observations))return null;
 const results=observations.map(o=>{
  const ref=o.year===2024?REFERENCE_2024[o.country]:undefined;
  if(!ref||typeof o.value!=="number"||!Number.isFinite(o.value)||o.value<=0)return {country:o.country,status:"unavailable",reference:ref??null};
  const delta=o.value-ref.value;
  const relative=Math.abs(delta)/ref.value;
  const comparable_date=ref.reference_date==="2024-07-01";
  return {country:o.country,primary_value:o.value,reference:ref,delta_persons:delta,absolute_relative_difference:relative,comparable_date,status:!comparable_date?"different_reference_date":relative<=0.01?"within_review_threshold":"needs_review"};
 });
 return {method:"Cross-publisher comparison against curated national snapshots",reference_review_date:"2026-11-21",review_threshold_relative:0.01,threshold_is_not_statistical_confidence:true,reference_live_fetched:false,source_independence_verified:false,results,limitations:["World Bank may incorporate the same national data.","Reference vintages may differ; discrepancies are not automatically errors.","Japan has an October reference date; no same-date verification assigned.","1% is an operational review threshold, not a statistical confidence interval."]};
}
