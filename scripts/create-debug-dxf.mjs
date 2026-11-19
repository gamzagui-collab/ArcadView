import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Original synthetic geometry, safe to share. All coordinates are millimetres.
const pairs = [];
const add = (...values) => pairs.push(...values.map(String));
add(0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1032',9,'$INSUNITS',70,4,0,'ENDSEC');
add(0,'SECTION',2,'TABLES',0,'TABLE',2,'LAYER',70,5);
for (const [name,color] of [['OUTLINE',7],['LABELS',2],['BLOCKS',3],['HATCH',4],['HIDDEN',-1]]) {
  add(0,'LAYER',2,name,70,0,62,color,6,'CONTINUOUS');
}
add(0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'BLOCKS',0,'BLOCK',8,'0',2,'DEBUG_BLOCK',70,0,10,0,20,0,30,0,3,'DEBUG_BLOCK',1,'');
add(0,'CIRCLE',8,'0',10,50,20,50,30,0,40,50,0,'ENDBLK',8,'0',0,'ENDSEC');
add(0,'SECTION',2,'ENTITIES',0,'LWPOLYLINE',8,'OUTLINE',90,4,70,1);
for (const [x,y] of [[0,0],[1000,0],[1000,500],[0,500]]) add(10,x,20,y);
add(0,'TEXT',8,'LABELS',10,0,20,650,30,0,40,35,1,'한글 치수 시험 1000 x 500 mm');
add(0,'INSERT',8,'BLOCKS',2,'DEBUG_BLOCK',10,1200,20,0,30,0,41,1,42,1,43,1);
add(0,'HATCH',8,'HATCH',10,0,20,0,30,0,210,0,220,0,230,1,2,'SOLID',70,1,71,0,91,1,92,2,72,0,73,1,93,4);
for (const [x,y] of [[1200,200],[1400,200],[1400,400],[1200,400]]) add(10,x,20,y);
add(97,0,75,0,76,1,98,0);
add(0,'LINE',8,'HIDDEN',10,0,20,-100,30,0,11,500,21,-100,31,0,0,'ENDSEC',0,'EOF');
const destination = resolve(process.argv[2] || 'debug-artifacts/izcad-known-geometry.dxf');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, pairs.join('\n') + '\n');
console.log(JSON.stringify({ path: destination, units:'mm', rectangle:{width:1000,height:500,perimeter:3000,area:500000},
  expected:'White rectangle; yellow Korean label; green circle block at (1250,50); cyan square hatch; red line on initially hidden layer.' },null,2));
