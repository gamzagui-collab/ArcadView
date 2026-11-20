export function elf16kAligned(bytes) {
  if(bytes.length<64||bytes.subarray(0,4).toString('hex')!=='7f454c46'||bytes[5]!==1)return false;
  const wide=bytes[4]===2;if(!wide&&bytes[4]!==1)return false;
  const offset=wide?Number(bytes.readBigUInt64LE(32)):bytes.readUInt32LE(28),size=bytes.readUInt16LE(wide?54:42),count=bytes.readUInt16LE(wide?56:44);
  if(size<(wide?56:32)||!Number.isSafeInteger(offset)||offset+size*count>bytes.length)return false;
  let loads=0;
  for(let i=0;i<count;i++){
    const p=offset+i*size;if(bytes.readUInt32LE(p)!==1)continue;loads++;
    const read=n=>wide?bytes.readBigUInt64LE(p+n):BigInt(bytes.readUInt32LE(p+n));
    const align=read(wide?48:28),file=read(wide?8:4),address=read(wide?16:8);
    if(align<16384n||file%16384n!==address%16384n)return false;
  }
  return loads>0;
}
export function zipDataOffset(archive,entry){return entry.offset+30+archive.readUInt16LE(entry.offset+26)+archive.readUInt16LE(entry.offset+28);}
