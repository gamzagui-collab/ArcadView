import{calculationOf,type TakeoffCalculation as Mode,type TakeoffDocument as Doc,type TakeoffLayer}from'./model';
const MODES:Mode[]=['volume','area'];
const PREFIX={volume:'체적',area:'면적'};
const generated=(name:string)=>/^(적산\s*|체적\s*|면적\s*)\d+$/.test(name);
function allocateName(names:Set<string>,mode:Mode,context='',minimum=0){
 let number=minimum;const pattern=new RegExp('(?:^| · )'+PREFIX[mode]+'\\s*(\\d+)$');
 for(const name of names){const match=pattern.exec(name),n=Number(match?.[1]);if(Number.isSafeInteger(n)&&n>number&&n<1e9)number=n;}
 let name:string;do{const base=PREFIX[mode]+(++number);name=context?context.slice(0,48-base.length-3)+' · '+base:base;}while(names.has(name));names.add(name);return name;
}
/** A deterministic, in-memory upgrade. Merely opening an old drawing does not
 * write it. The editor's next acknowledged save persists this representation. */
export function separateCalculationLayers(doc:Doc):Doc{
 const names=new Set(doc.layers.map(l=>l.name)),ids=new Set(doc.layers.map(l=>l.id)),kinds=new Map<string,Set<Mode>>(),mapping=new Map<string,Partial<Record<Mode,string>>>(),layers:TakeoffLayer[]=[];
 for(const o of doc.objects){if(!kinds.has(o.layerId))kinds.set(o.layerId,new Set());kinds.get(o.layerId)!.add(calculationOf(o));}
 for(const layer of doc.layers){
  const modes=kinds.get(layer.id)??new Set<Mode>(),primary=layer.calculation??(modes.size===1?[...modes][0]:modes.size?'volume':/^면적\s*\d+$/.test(layer.name)?'area':layer.id===doc.activeLayerId?doc.options.calculation??'volume':'volume');
  const name=/^적산\s*\d+$/.test(layer.name)?allocateName(names,primary):layer.name;
  layers.push(layer.calculation===primary&&name===layer.name?layer:{...layer,name,calculation:primary});
  const map:Partial<Record<Mode,string>>={[primary]:layer.id};
  for(const mode of MODES)if(mode!==primary&&modes.has(mode)){
   let id=layer.id+':'+mode,n=1;while(ids.has(id))id=layer.id+':'+mode+':'+(++n);ids.add(id);
   layers.push({id,name:allocateName(names,mode,generated(layer.name)?'':layer.name),visible:layer.visible,calculation:mode});map[mode]=id;
  }
  mapping.set(layer.id,map);
 }
 const objects=doc.objects.map(o=>{const id=mapping.get(o.layerId)?.[calculationOf(o)];return id&&id!==o.layerId?{...o,layerId:id}:o;});
 const remembered:Partial<Record<Mode,string>>={};for(const mode of MODES){const id=doc.options.calculationLayers?.[mode];if(layers.some(l=>l.id===id&&l.calculation===mode))remembered[mode]=id;}
 const oldActive=layers.find(l=>l.id===doc.activeLayerId)!;remembered[oldActive.calculation!]=oldActive.id;
 const mode=doc.options.calculation??oldActive.calculation!,preferred=mapping.get(doc.activeLayerId)?.[mode]??remembered[mode];
 let active=layers.find(l=>l.id===preferred&&l.calculation===mode)??layers.find(l=>l.calculation===mode);
 if(!active){let id='takeoff-'+mode,n=1;while(ids.has(id))id='takeoff-'+mode+'-'+(++n);active={id,name:allocateName(names,mode),visible:true,calculation:mode};layers.push(active);}
 remembered[mode]=active.id;
 const sameMemory=MODES.every(k=>remembered[k]===doc.options.calculationLayers?.[k]);
 if(layers.length===doc.layers.length&&layers.every((l,i)=>l===doc.layers[i])&&objects.every((o,i)=>o===doc.objects[i])&&active.id===doc.activeLayerId&&doc.options.calculation===mode&&sameMemory)return doc;
 return{...doc,layers,objects,activeLayerId:active.id,options:{...doc.options,calculation:mode,calculationLayers:remembered}};
}
function activate(doc:Doc,id:string):Doc{
 const layer=doc.layers.find(l=>l.id===id);if(!layer?.calculation)throw Error('대상 적산 레이어가 없습니다.');
 return{...doc,activeLayerId:id,layers:doc.layers.map(l=>l.id===id&&!l.visible?{...l,visible:true}:l),options:{...doc.options,calculation:layer.calculation,calculationLayers:{...doc.options.calculationLayers,[layer.calculation]:id}}};
}
export function addCalculationLayer(doc:Doc,id:string,mode:Mode=doc.options.calculation??'volume'):Doc{
 const base=separateCalculationLayers(doc);if(!id||base.layers.some(l=>l.id===id))throw Error('적산 레이어가 유효하지 않습니다.');
 return activate({...base,layers:[...base.layers,{id,name:allocateName(new Set(base.layers.map(l=>l.name)),mode,'',base.layers.filter(l=>l.calculation===mode).length),visible:true,calculation:mode}]},id);
}
export function switchCalculationLayer(doc:Doc,mode:Mode,id:string):Doc{
 const base=separateCalculationLayers(doc),current=base.layers.find(l=>l.id===base.activeLayerId),remembered=base.options.calculationLayers?.[mode];
 const layer=current?.calculation===mode?current:base.layers.find(l=>l.id===remembered&&l.calculation===mode)??base.layers.find(l=>l.calculation===mode);
 return layer?activate(base,layer.id):addCalculationLayer(base,id,mode);
}
export function selectCalculationLayer(doc:Doc,id:string){return activate(separateCalculationLayers(doc),id);}
export function removeCalculationLayer(doc:Doc,id:string):Doc{
 const base=separateCalculationLayers(doc);if(base.layers.length<=1||!base.layers.some(l=>l.id===id))return base;
 const layers=base.layers.filter(l=>l.id!==id),memory={...base.options.calculationLayers};for(const mode of MODES)if(memory[mode]===id)delete memory[mode];
 const next={...base,layers,objects:base.objects.filter(o=>o.layerId!==id),options:{...base.options,calculationLayers:memory}},active=layers.find(l=>l.id===base.activeLayerId)??layers.find(l=>l.calculation===base.options.calculation)??layers[0];return activate(next,active.id);
}
