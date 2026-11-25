// Bounded structural PNG validation for Sprite's public vision inputs.
// Checks integrity of chunks, not pixel-level decompression or visual accuracy.
const MAGIC=[137,80,78,71,13,10,26,10];
const TABLE=Uint32Array.from({length:256},(_,i)=>{
 let c=i;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;
});
export function crc32(bytes,start=0,end=bytes.length){
 let c=0xffffffff;for(let i=start;i<end;i++)c=(c>>>8)^TABLE[(c^bytes[i])&255];return (c^0xffffffff)>>>0;
}
const DEPTHS={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
export function validateProbePng(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<57||bytes.length>262144||!MAGIC.every((x,i)=>bytes[i]===x))throw Error("Invalid PNG signature or size");
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let p=8,width=0,height=0,color=-1,depth=0,seenHeader=false,seenPalette=false,seenData=false,closedData=false,dataBytes=0,chunks=0;
 while(p+12<=bytes.length){
  if(++chunks>4096)throw Error("Excessive PNG chunks");
  const n=d.getUint32(p),type=String.fromCharCode(...bytes.subarray(p+4,p+8)),end=p+8+n;
  if(n>bytes.length-p-12||!/^[A-Za-z]{4}$/.test(type)||!(type[2]>="A"&&type[2]<="Z"))throw Error("Invalid PNG chunk");
  if(crc32(bytes,p+4,end)!==d.getUint32(end))throw Error("PNG CRC mismatch");
  if(!seenHeader&&type!=="IHDR")throw Error("Missing first IHDR");
  if(type==="IHDR"){
   if(seenHeader||n!==13)throw Error("Invalid IHDR");
   width=d.getUint32(p+8);height=d.getUint32(p+12);depth=bytes[p+16];color=bytes[p+17];
   if(!width||!height||width>16777216||height>Math.floor(16777216/width)||!DEPTHS[color]?.includes(depth)||bytes[p+18]!==0||bytes[p+19]!==0||bytes[p+20]>1)throw Error("Invalid PNG header fields");
   seenHeader=true;
  }else if(type==="PLTE"){
   if(seenPalette||seenData||color===0||color===4||!n||n%3||n>768||(color===3&&n/3>2**depth))throw Error("Invalid palette");
   seenPalette=true;
  }else if(type==="IDAT"){
   if(closedData||(color===3&&!seenPalette))throw Error("Invalid IDAT order");
   seenData=true;dataBytes+=n;
  }else if(type==="IEND"){
   if(n!==0||!seenData||!dataBytes||end+4!==bytes.length)throw Error("Invalid PNG termination");
   return {width,height,chunks,dataBytes};
  }else if(type[0]>="A"&&type[0]<="Z")throw Error("Unknown critical chunk");
  if(seenData&&type!=="IDAT")closedData=true;
  p=end+4;
 }
 throw Error("Truncated PNG");
}
