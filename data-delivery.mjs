// Sprite data delivery: deterministic, local-only transformations of operator-supplied public or fictional data.
// No network, credentials, customer attachments, persistence, model calls or marketplace submission.
const KEY=/^[A-Za-z][A-Za-z0-9_]{0,47}$/;
const FORBIDDEN=/(?:password|passwd|secret|token|credential|api_?key|private_?key|email|phone|ssn|address)/i;
const enc=new TextEncoder();
function cell(v){
  if(v===null)return "";
  if(typeof v==="number"&&Number.isFinite(v))return String(v);
  if(typeof v==="boolean")return String(v);
  if(typeof v!=="string"||v.length>512||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error("Invalid cell");
  // Prevent spreadsheet formula execution, including leading whitespace.
  return /^[\s]*[=+\-@]/.test(v)||/^[\t\r\n]/.test(v)?"'"+v:v;
}
const quote=s=>'"'+s.replace(/"/g,'""')+'"';
export async function buildDataDelivery(body){
  if(body?.source_kind!=="public"&&body?.source_kind!=="fictional")throw Error("Only declared public or fictional data allowed");
  if(body?.confirm_no_customer_data!==true)throw Error("Confirm no customer or private data");
  const {columns,rows}=body;
  if(!Array.isArray(columns)||columns.length<1||columns.length>20||new Set(columns).size!==columns.length||columns.some(c=>typeof c!=="string"||!KEY.test(c)||FORBIDDEN.test(c)))throw Error("Invalid, duplicate, or sensitive columns");
  if(!Array.isArray(rows)||rows.length<1||rows.length>500)throw Error("Require 1–500 rows");
  const seen=new Set(),clean=[];
  for(const row of rows){
    if(!row||Object.getPrototypeOf(row)!==Object.prototype||Object.keys(row).some(k=>!columns.includes(k)))throw Error("Unknown columns or invalid row");
    const values=columns.map(c=>{if(!Object.hasOwn(row,c))throw Error("Missing column "+c);return cell(row[c]);});
    const key=JSON.stringify(values);
    if(!seen.has(key)){seen.add(key);clean.push(values);}
  }
  const csv=[columns.map(quote).join(","),...clean.map(row=>row.map(quote).join(","))].join("\r\n")+"\r\n";
  const bytes=enc.encode(csv);
  if(bytes.length>131072)throw Error("Output exceeds 128 KiB");
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
  return {csv,manifest:{format:"CSV",source_kind:body.source_kind,source_claim_verified:false,rows_in:rows.length,rows_out:clean.length,duplicates_removed:rows.length-clean.length,columns,byte_size:bytes.length,sha256,formula_injection_escaped:true,marketplace_submission:false}};
}
