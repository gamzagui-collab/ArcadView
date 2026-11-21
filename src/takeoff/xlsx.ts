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
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${col(widths.length-1)}${rows.length}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="90"><pane xSplit="1" ySplit="6" topLeftCell="B7" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="B7" sqref="B7"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.map((row,r)=>`<row r="${r+1}"${row.height?` ht="${row.height}" customHeight="1"`:""}${row.outline?` outlineLevel="${row.outline}"`:""}>${row.cells.map((c,i)=>{
  const attr=`r="${col(i)}${r+1}" s="${c.style??0}"`;
  if(c.value===null)return`<c ${attr}/>`;
  if(typeof c.value==="string")return`<c ${attr} t="inlineStr"><is><t xml:space="preserve">${xml(c.value)}</t></is></c>`;
  if(!Number.isFinite(c.value))throw Error("집계표에 유효하지 않은 숫자가 있습니다.");
  return`<c ${attr}>${c.formula?`<f>${xml(c.formula)}</f>`:""}<v>${c.value}</v></c>`;
 }).join("")}</row>`).join("")}</sheetData>${filter&&rows.length>6?`<autoFilter ref="A6:${col(widths.length-1)}${rows.length}"/>`:""}${merges.length?`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`:""}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;C&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
}
const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.000"/></numFmts><fonts count="5"><font><sz val="11"/><color rgb="FF20394E"/><name val="맑은 고딕"/></font><font><b/><sz val="16"/><color rgb="FF123A60"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FF123A60"/><name val="맑은 고딕"/></font><font><sz val="10"/><color rgb="FF567084"/><name val="맑은 고딕"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173E61"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F2FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F6F9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD6E3EB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">${[
 [0,0,0,0,"left"],[164,0,0,0,"right"],[0,1,0,0,"left"],[0,2,2,0,"center"],[164,3,4,1,"right"],[0,3,4,1,"left"],[0,3,3,0,"left"],[164,2,2,0,"right"],[0,4,0,0,"left"]
 ].map(([n,f,fill,b,a])=>`<xf numFmtId="${n}" fontId="${f}" fillId="${fill}" borderId="${b}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${a}" vertical="center" wrapText="1"/></xf>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
export function exportTakeoffXlsx(doc:TakeoffDocument,created=new Date()){
 const report=buildQuantityReport(doc),rows:Row[]=[],basis:Row[]=[],merges:string[]=[],mainRows=new Map<string,number>(),basisRows=new Map<string,number>();
 const heading=(target:Row[],title:string,note:string)=>{target.push({cells:[]},{cells:[cell(title,2)],height:30},{cells:[cell(note,8)],height:23},{cells:[]},{cells:[]});};
 heading(rows,report.drawing,"콘크리트 물량 집계. 길이·너비·높이: m, 체적: m³. 숨긴 레이어 포함.");
 rows[3]={cells:[cell("자유형 슬래브·기둥의 너비는 면적÷대표 변 길이로 환산합니다. 옹벽·슬래브 두께와 객체 ID는 산출근거 참조.",8)],height:30};
 merges.push("A2:F2","A3:F3","A4:F4");rows.push({cells:["레이어 이름","부재","길이 (m)","너비 (m)","높이 (m)","체적 (m³)"].map(v=>cell(v,3)),height:25});
 heading(basis,report.drawing,`산출근거. 도면 1단위: ${report.unit}. 길이·규격은 m, 면적은 m². ${created.toLocaleString("ko-KR",{timeZone:"Asia/Seoul",hour12:false})} (한국 시간)`);
 basis[3]={cells:[cell("중첩·개구부 공제 전 개략 체적. 기둥은 단면적×높이, 옹벽·보는 중심선 총길이를 사용합니다.",8)],height:25};
 basis.push({cells:["객체 ID","레이어 이름","부재","길이/대표 변 (m)","면적 (m²)","높이 (m)","두께 (m)","너비 (m)","보 깊이 (m)","길이·너비 구분","화면 표시"].map(v=>cell(v,3)),height:30});
 for(const item of report.items){basisRows.set(item.id,basis.length+1);basis.push({cells:[cell(item.id),cell(item.layer),cell(NAMES[item.kind]),cell(item.lengthM,1),cell(item.areaM2||null,1),cell(item.kind==="beam"?null:item.heightM??null,1),cell(item.thicknessM??null,1),cell(item.kind==="beam"?item.widthM!:null,1),cell(item.kind==="beam"?item.heightM!:null,1),cell(item.equivalentWidth?"대표 변·환산 너비":item.kind==="slab"||item.kind==="column"?"직사각형 단면":"중심선 길이"),cell(item.hidden?"숨김 (집계 포함)":"표시")],height:30});}
 for(const layer of report.layers){
  const section=rows.length+1;rows.push({cells:[cell(layer.name,6),...Array.from({length:5},()=>cell(null,6))],height:24});merges.push(`A${section}:F${section}`);const subtotals:number[]=[];
  for(const kind of KINDS){const items=layer.items.filter(o=>o.kind===kind);if(!items.length)continue;const start=rows.length+1;
   for(const item of items){const r=rows.length+1,b=basisRows.get(item.id)!,ref=(column:string)=>`'산출근거'!${column}${b}`;mainRows.set(item.id,r);
    const width=item.widthM===undefined?cell(null,1):cell(item.widthM,1,kind==="beam"?ref("H"):`${ref("E")}/C${r}`),height=item.heightM===undefined?cell(null,1):cell(item.heightM,1,ref(kind==="beam"?"I":"F"));
    const formula=kind==="wall"?`C${r}*E${r}*${ref("G")}`:kind==="slab"?`C${r}*D${r}*${ref("G")}`:`C${r}*D${r}*E${r}`;
    rows.push({cells:[cell(layer.name),cell(NAMES[kind]),cell(item.lengthM,1,ref("D")),width,height,cell(item.volumeM3,1,formula)],height:Math.max(21,Math.ceil([...layer.name].reduce((n,ch)=>n+(ch.charCodeAt(0)>127?2:1),0)/26)*15),outline:1});
   }
   subtotals.push(rows.length+1);rows.push({cells:[cell(layer.name,5),cell(NAMES[kind]+" 소계",5),cell(null,5),cell(null,5),cell(null,5),cell(items.reduce((n,o)=>n+o.volumeM3,0),4,`SUM(F${start}:F${rows.length})`)],height:23});
  }
  rows.push({cells:[cell(layer.name,6),cell("레이어 합계",6),cell(null,6),cell(null,6),cell(null,6),cell(report.totals.layers[layer.id].volumeM3,4,`SUM(${subtotals.length?subtotals.map(r=>`F${r}`).join(","):"0"})`)],height:25});
 }
 const end=rows.length;rows.push({cells:[]});
 for(const kind of KINDS)rows.push({cells:[cell("도면 전체",5),cell(NAMES[kind]+" 총계",5),cell(null,5),cell(null,5),cell(null,5),cell(report.totals.groups[kind].volumeM3,4,`SUMIFS($F$7:$F$${end},$B$7:$B$${end},"${NAMES[kind]} 소계")`)],height:23});
 rows.push({cells:[cell("도면 전체 총계",3),cell("모든 레이어",3),cell(null,3),cell(null,3),cell(null,3),cell(report.totals.volumeM3,7,`SUMIFS($F$7:$F$${end},$B$7:$B$${end},"레이어 합계")`)],height:28});
 if(rows.length>1048576)throw Error("Excel의 최대 행 수를 초과했습니다.");
 const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="물량집계" sheetId="1" r:id="rId1"/><sheet name="산출근거" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'물량집계'!$1:$6</definedName><definedName name="_xlnm.Print_Titles" localSheetId="1">'산출근거'!$1:$6</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
 const relationships=(entries:Array<[string,string,string]>)=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries.map(([id,type,target])=>`<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("")}</Relationships>`;
 const files:Record<string,Uint8Array>={},put=(name:string,value:string)=>{files[name]=strToU8(value);};
 put("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[["/xl/workbook.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],["/xl/styles.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"],["/xl/worksheets/sheet1.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"],["/xl/worksheets/sheet2.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"],["/docProps/core.xml","application/vnd.openxmlformats-package.core-properties+xml"]].map(([name,type])=>`<Override PartName="${name}" ContentType="${type}"/>`).join("")}</Types>`);
 put("_rels/.rels",relationships([["rId1",R+"/officeDocument","xl/workbook.xml"],["rId2","http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties","docProps/core.xml"]]));
 put("xl/_rels/workbook.xml.rels",relationships([["rId1",R+"/worksheet","worksheets/sheet1.xml"],["rId2",R+"/worksheet","worksheets/sheet2.xml"],["rId3",R+"/styles","styles.xml"]]));
 put("xl/workbook.xml",workbook);put("xl/styles.xml",styles);put("xl/worksheets/sheet1.xml",sheet(rows,[28,16,16,16,16,20],merges));put("xl/worksheets/sheet2.xml",sheet(basis,[40,28,12,20,18,16,16,16,16,28,24],["A2:K2","A3:K3","A4:K4"],true));
 put("docProps/core.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(report.drawing)}</dc:title><dc:creator>GUI's Arc Industry</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created.toISOString()}</dcterms:created></cp:coreProperties>`);
 const stem=report.drawing.replace(/\.(dwg|dxf)$/i,"").replace(/[\x00-\x1f\\/:*?"<>|]/g,"_").replace(/^[. ]+|[. ]+$/g,"").slice(0,140)||"도면";
 return{name:stem+"_물량집계.xlsx",bytes:zipSync(files,{level:6}),report,mainRows,basisRows,totalRow:rows.length};
}
