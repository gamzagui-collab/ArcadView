import {strToU8,zipSync} from "fflate";
import {KINDS,NAMES,type TakeoffDocument} from "./model";
import {buildQuantityReport} from "./quantityReport";

const NS="http://schemas.openxmlformats.org/spreadsheetml/2006/main",R="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const xml=(s:string)=>s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
type Cell={value:string|number|null;formula?:string;style?:number};
type Row={cells:Cell[];height?:number;outline?:number};
const cell=(value:Cell["value"],style=0,formula?:string):Cell=>({value,style,formula});
const col=(n:number)=>{let s="";for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function sheet(rows:Row[],widths:number[],merges:string[],filter=false){
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${col(widths.length-1)}${rows.length}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"><pane xSplit="2" ySplit="6" topLeftCell="C7" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C7" sqref="C7"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.map((row,r)=>`<row r="${r+1}"${row.height?` ht="${row.height}" customHeight="1"`:""}${row.outline?` outlineLevel="${row.outline}"`:""}>${row.cells.map((c,i)=>{
  const attr=`r="${col(i)}${r+1}" s="${c.style??0}"`;
  if(c.value===null)return`<c ${attr}/>`;
  if(typeof c.value==="string")return c.formula?`<c ${attr} t="str"><f>${xml(c.formula)}</f><v>${xml(c.value)}</v></c>`:`<c ${attr} t="inlineStr"><is><t xml:space="preserve">${xml(c.value)}</t></is></c>`;
  if(!Number.isFinite(c.value))throw Error("집계표에 유효하지 않은 숫자가 있습니다.");
  return`<c ${attr}>${c.formula?`<f>${xml(c.formula)}</f>`:""}<v>${c.value}</v></c>`;
 }).join("")}</row>`).join("")}</sheetData>${filter&&rows.length>6?`<autoFilter ref="A6:${col(widths.length-1)}${rows.length}"/>`:""}${merges.length?`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`:""}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.2"/><pageSetup paperSize="${widths.length>7?8:9}" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;C&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
}
const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.000"/><numFmt numFmtId="165" formatCode="#,##0.000000"/></numFmts><fonts count="5"><font><sz val="11"/><color rgb="FF20394E"/><name val="맑은 고딕"/></font><font><b/><sz val="16"/><color rgb="FF123A60"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FF123A60"/><name val="맑은 고딕"/></font><font><sz val="10"/><color rgb="FF567084"/><name val="맑은 고딕"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173E61"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F2FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F6F9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD6E3EB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10">${[
 [0,0,0,0,"left"],[164,0,0,0,"right"],[0,1,0,0,"left"],[0,2,2,0,"center"],[164,3,4,1,"right"],[0,3,4,1,"left"],[0,3,3,0,"left"],[164,2,2,0,"right"],[0,4,0,0,"left"],[165,0,0,0,"right"]
 ].map(([n,f,fill,b,a])=>`<xf numFmtId="${n}" fontId="${f}" fillId="${fill}" borderId="${b}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${a}" vertical="center" wrapText="1"/></xf>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
export function exportTakeoffXlsx(doc:TakeoffDocument,created=new Date()){
 const report=buildQuantityReport(doc),rows:Row[]=[],areaRowsData:Row[]=[],basis:Row[]=[],merges:string[]=[],areaMerges:string[]=[],mainRows=new Map<string,number>(),areaRows=new Map<string,number>(),basisRows=new Map<string,number>();
 const hasArea=report.items.some(o=>o.calculation==="area");
 const heading=(target:Row[],title:string,note:string)=>{target.push({cells:[]},{cells:[cell(title,2)],height:30},{cells:[cell(note,8)],height:23},{cells:[]},{cells:[]});};
 heading(basis,report.drawing,`원본 산출근거 (내보낸 시점). 도면 1단위: ${report.unit}. 길이·규격은 m, 면적은 m². ${created.toLocaleString("ko-KR",{timeZone:"Asia/Seoul",hour12:false})} (한국 시간)`);
 basis[3]={cells:[cell("체적과 면적은 별도 집계합니다. 면적은 그린 영역 그대로 산출하며 높이·두께를 사용하지 않습니다. 중첩·개구부 공제 전 개략 물량.",8)],height:30};
 basis.push({cells:["객체 ID","레이어 이름","부재","길이/대표 변 (m)","면적 (m²)","높이 (m)","두께 (m)","너비 (m)","보 깊이 (m)","계산 방식·길이 구분","화면 표시"].map(v=>cell(v,3)),height:30});
 for(const item of report.items){basisRows.set(item.id,basis.length+1);basis.push({cells:[cell(item.id),cell(item.layer),cell(NAMES[item.kind]),cell(item.lengthM,9),cell(item.areaM2||null,1),cell(item.heightM??null,9),cell(item.thicknessM??null,9),cell(item.widthM??null,9),cell(item.depthM??null,9),cell((item.calculation==="area"?"면적 · ":"체적 · ")+(item.equivalentWidth?"대표 변·환산 너비":item.widthM!==undefined&&item.kind!=="beam"?"직사각형 영역":"중심선 길이")),cell(item.hidden?"숨김 (집계 포함)":"표시")],height:36});}
 type Factor={name:string;column:string;value:number;unit:string};
 const expression=(factors:Factor[],r:number,amountColumn:string,amount:number,unit:string,style=0)=>cell(factors.map(f=>`${f.name} ${f.value.toFixed(6)} ${f.unit}`).join(" × ")+` = ${amount.toFixed(3)} ${unit}`,style,factors.map(f=>`"${f.name} "&TEXT(${f.column}${r},"0.000000")&" ${f.unit}"`).join('&" × "&')+`&" = "&TEXT(${amountColumn}${r},"0.000")&" ${unit}"`);
 function table(target:Row[],mode:"volume"|"area",tableMerges:string[],rowMap:Map<string,number>){
  const area=mode==="area",unit=area?"m²":"m³",amountColumn=area?"E":"I",last=area?"G":"K",count=area?7:11,amount=(q:{volumeM3:number;areaOnlyM2:number})=>area?q.areaOnlyM2:q.volumeM3;
  heading(target,report.drawing,`${area?"면적 집계. 길이·너비: m, 면적: m².":"체적 집계. 규격: m, 면적: m², 체적: m³."} 숨긴 레이어 포함.`);
  target[3]={cells:[cell(area?"높이·두께 없는 영역 면적. 자유형 너비는 면적÷대표 변 환산값. 산출근거는 내보낸 시점의 원래 값입니다.":"규격 수정 시 물량·총계·산식 자동 계산. 자유형 너비는 면적÷대표 변 환산값. 중첩·개구부 공제 전 개략 물량.",8)],height:30};
  tableMerges.push(`A2:${last}2`,`A3:${last}3`,`A4:${last}4`);
  target.push({cells:(area?["레이어 이름","부재","길이 (m)","너비 (m)","면적 (m²)","객체 ID","산식"]:["레이어 이름","부재","길이 (m)","너비 (m)","높이 (m)","두께 (m)","깊이 (m)","면적 (m²)","체적 (m³)","객체 ID","산식"]).map(v=>cell(v,3)),height:30});
  const aggregate=(label:string,description:string,value:number,formula:string,style=5)=>{
   const r=target.length+1,cells=Array.from({length:count},()=>cell(null,style));cells[0]=cell(label,style);cells[1]=cell(description,style);cells[area?4:8]=cell(value,style===3?7:4,formula);
   cells[count-1]=cell(`${description} = ${value.toFixed(3)} ${unit}`,style,`"${description} = "&TEXT(${amountColumn}${r},"0.000")&" ${unit}"`);target.push({cells,height:26});
  };
  for(const layer of report.layers){
   const section=target.length+1;target.push({cells:[cell(layer.name,6),...Array.from({length:count-1},()=>cell(null,6))],height:24});tableMerges.push(`A${section}:${last}${section}`);const subtotals:number[]=[];
   for(const kind of KINDS){const items=layer.items.filter(o=>o.kind===kind&&o.calculation===mode);if(!items.length)continue;const start=target.length+1;
    for(const item of items){
     const r=target.length+1,b=basisRows.get(item.id)!,ref=(column:string)=>`'산출근거'!${column}${b}`;rowMap.set(item.id,r);
     const input=(value:number|undefined,source:string)=>value===undefined?cell(null,9):cell(value,9,ref(source));
     const length=input(item.lengthM,"D"),width=input(item.widthM,"H"),height=input(item.heightM,"F"),thickness=input(item.thicknessM,"G"),depth=input(item.depthM,"I");
     const areaValue=item.areaM2?cell(item.areaM2,1,`C${r}*D${r}`):cell(null,1);
     const formula=area?`C${r}*D${r}`:kind==="wall"?`C${r}*E${r}*F${r}`:kind==="beam"?`C${r}*D${r}*G${r}`:kind==="slab"?`H${r}*F${r}`:`H${r}*E${r}`;
     const factor=(name:string,column:string,value:number,unit="m"):Factor=>({name,column,value,unit});
     const factors=area?[factor(item.equivalentWidth?"대표 변":"길이","C",item.lengthM),factor(item.equivalentWidth?"환산 너비":"너비","D",item.widthM!)]:kind==="wall"?[factor("길이","C",item.lengthM),factor("높이","E",item.heightM!),factor("두께","F",item.thicknessM!)]:kind==="beam"?[factor("길이","C",item.lengthM),factor("너비","D",item.widthM!),factor("깊이","G",item.depthM!)]:[factor("면적","H",item.areaM2,"m²"),kind==="slab"?factor("두께","F",item.thicknessM!):factor("높이","E",item.heightM!)];
     const result=area?item.areaM2:item.volumeM3,amountCell=cell(result,1,formula),math=expression(factors,r,amountColumn,result,unit);
     target.push({cells:area?[cell(layer.name),cell(NAMES[kind]),length,width,amountCell,cell(item.id,8),math]:[cell(layer.name),cell(NAMES[kind]),length,width,height,thickness,depth,areaValue,amountCell,cell(item.id,8),math],height:Math.max(42,Math.ceil([...layer.name].length/18)*15),outline:1});
    }
    subtotals.push(target.length+1);aggregate(layer.name,NAMES[kind]+" 소계",items.reduce((n,o)=>n+(area?o.areaM2:o.volumeM3),0),`SUM(${amountColumn}${start}:${amountColumn}${target.length})`);
   }
   aggregate(layer.name,"레이어 합계",amount(report.totals.layers[layer.id]),`SUM(${subtotals.length?subtotals.map(r=>`${amountColumn}${r}`).join(","):"0"})`,6);
  }
  const end=target.length;target.push({cells:[]});
  for(const kind of KINDS)aggregate("도면 전체",NAMES[kind]+" 총계",amount(report.totals.groups[kind]),`SUMIFS($${amountColumn}$7:$${amountColumn}$${end},$B$7:$B$${end},"${NAMES[kind]} 소계")`);
  aggregate("도면 전체 총계","모든 레이어",amount(report.totals),`SUMIFS($${amountColumn}$7:$${amountColumn}$${end},$B$7:$B$${end},"레이어 합계")`,3);
  if(target.length>1048576)throw Error("Excel의 최대 행 수를 초과했습니다.");
 }
 table(rows,"volume",merges,mainRows);if(hasArea)table(areaRowsData,"area",areaMerges,areaRows);

 const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${R}"><bookViews><workbookView activeTab="${hasArea&&report.totals.volumeM3===0?2:0}"/></bookViews><sheets><sheet name="물량집계" sheetId="1" r:id="rId1"/><sheet name="산출근거" sheetId="2" r:id="rId2"/>${hasArea?'<sheet name="면적집계" sheetId="3" r:id="rId4"/>':""}</sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'물량집계'!$1:$6</definedName><definedName name="_xlnm.Print_Titles" localSheetId="1">'산출근거'!$1:$6</definedName>${hasArea?'<definedName name="_xlnm.Print_Titles" localSheetId="2">\'면적집계\'!$1:$6</definedName>':""}</definedNames><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
 const relationships=(entries:Array<[string,string,string]>)=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries.map(([id,type,target])=>`<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("")}</Relationships>`;
 const files:Record<string,Uint8Array>={},put=(name:string,value:string)=>{files[name]=strToU8(value);};
 put("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[["/xl/workbook.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],["/xl/styles.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"],["/xl/worksheets/sheet1.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"],["/xl/worksheets/sheet2.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"],["/docProps/core.xml","application/vnd.openxmlformats-package.core-properties+xml"],...hasArea?[["/xl/worksheets/sheet3.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"]]:[]].map(([name,type])=>`<Override PartName="${name}" ContentType="${type}"/>`).join("")}</Types>`);
 put("_rels/.rels",relationships([["rId1",R+"/officeDocument","xl/workbook.xml"],["rId2","http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties","docProps/core.xml"]]));
 put("xl/_rels/workbook.xml.rels",relationships([["rId1",R+"/worksheet","worksheets/sheet1.xml"],["rId2",R+"/worksheet","worksheets/sheet2.xml"],["rId3",R+"/styles","styles.xml"],...hasArea?[["rId4",R+"/worksheet","worksheets/sheet3.xml"] as [string,string,string]]:[]]));
 put("xl/workbook.xml",workbook);put("xl/styles.xml",styles);put("xl/worksheets/sheet1.xml",sheet(rows,[25,12,17,17,17,17,17,16,17,23,72],merges));put("xl/worksheets/sheet2.xml",sheet(basis,[40,28,12,20,18,16,16,16,16,28,24],["A2:K2","A3:K3","A4:K4"],true));
 if(hasArea)put("xl/worksheets/sheet3.xml",sheet(areaRowsData,[25,12,17,17,17,23,72],areaMerges));
 put("docProps/core.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(report.drawing)}</dc:title><dc:creator>GUI's Arc Industry</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created.toISOString()}</dcterms:created></cp:coreProperties>`);
 const stem=report.drawing.replace(/\.(dwg|dxf)$/i,"").replace(/[\x00-\x1f\\/:*?"<>|]/g,"_").replace(/^[. ]+|[. ]+$/g,"").slice(0,140)||"도면";
 return{name:stem+"_물량집계.xlsx",bytes:zipSync(files,{level:6}),report,mainRows,areaRows,basisRows,totalRow:rows.length,areaTotalRow:areaRowsData.length};
}
