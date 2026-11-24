export const QUALITY_KEYS=Object.freeze(["relevance","completeness","feasibility","acceptance","verification","price_scope"]);
export function reviewStructure(message){
 const raw=typeof message==="string"?message:"";
 const headings={relevance:/^\s*(?:relevance|目标与相关性)\s*[:：]/im,completeness:/^\s*(?:completeness|步骤与交付物)\s*[:：]/im,feasibility:/^\s*(?:feasibility|可行性与依赖)\s*[:：]/im,acceptance:/^\s*(?:acceptance criteria|验收标准)\s*[:：]/im,verification:/^\s*(?:verification and evidence|验证与证据)\s*[:：]/im,price_scope:/^\s*(?:price and scope|价格与范围)\s*[:：]/im};
 const hits=QUALITY_KEYS.map(key=>({key,match:headings[key].exec(raw)})).filter(x=>x.match).sort((a,b)=>a.match.index-b.match.index);
 const covered=hits.filter((h,i)=>raw.slice(h.match.index+h.match[0].length,hits[i+1]?.match.index??raw.length).trim().length>=12).map(h=>h.key);
 const missing=QUALITY_KEYS.filter(k=>!covered.includes(k));
 return {structural_only:true,covered,missing,passed:missing.length===0,semantic_review_required:true};
}
export function selectiveRevision(original,flags,replacements){
 if(!original||!Array.isArray(flags)||!replacements||new Set(flags).size!==flags.length||flags.some(k=>!QUALITY_KEYS.includes(k))||Object.keys(replacements).some(k=>!flags.includes(k))||flags.some(k=>typeof replacements[k]!=="string"||replacements[k].trim().length<12))throw Error("Invalid selective revision");
 return {...original,...Object.fromEntries(flags.map(k=>[k,replacements[k]]))};
}
