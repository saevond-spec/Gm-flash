export function structuredModelText(out){
 if(!out||typeof out!=="object"||out.choices?.[0]?.finish_reason==="length")throw Error("AI response missing or truncated");
 const raw=out.choices?.[0]?.message?.content??out.response??out.output;
 if(typeof raw==="string"&&raw.trim()&&raw.length<=24000)return raw;
 if(raw&&typeof raw==="object"&&!Array.isArray(raw)){const s=JSON.stringify(raw);if(s.length<=24000)return s;}
 throw Error("AI structured response unavailable");
}