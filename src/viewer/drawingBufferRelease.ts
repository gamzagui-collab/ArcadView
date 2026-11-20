/** Only pass buffers owned by a destroyed viewer, never original File/Blob data. */
export function retireDrawingBuffers(buffers:Iterable<ArrayBuffer>):void {
  const owned=[...new Set(buffers)].filter(b=>b.byteLength>0);
  if(!owned.length||typeof MessageChannel==="undefined")return;
  // Main-thread GC need not run when the next worker allocates a large scene.
  // Transfer backing stores out of the old views and close both queued ports so
  // they cannot keep hundreds of MiB alive until an unrelated main-thread GC.
  let channel:MessageChannel|undefined;
  try{channel=new MessageChannel();channel.port1.postMessage(null,owned);}catch{/* Older WebViews fall back to ordinary GC. */}
  finally{channel?.port1.close();channel?.port2.close();}
}

export function collectRenderBuffers(scene:any):Set<ArrayBuffer>{
  const buffers=new Set<ArrayBuffer>();
  const add=(view:any)=>{if(view?.buffer instanceof ArrayBuffer)buffers.add(view.buffer);};
  scene?.traverse?.((object:any)=>{
    for(const attribute of Object.values(object.geometry?.attributes??{})as any[])add(attribute.array??attribute.data?.array);
    add(object.geometry?.index?.array);
  });
  return buffers;
}
