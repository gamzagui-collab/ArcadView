"""Draw Arcad's offline GIF lessons from an original, reproducible sample plan.

Run: python scripts/generate-home-guides.py (Pillow 12). No customer drawing,
screen recording, network service or account is used. All dimensions are mm.
The same line geometry is included as sample-floor-plan.dxf for inspection.
"""
from pathlib import Path
import math
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/tutorials"
OUT.mkdir(parents=True, exist_ok=True)
W, H, S = 800, 500, 2
BG, NAVY, LINE = "#0b141e", "#102b42", "#345d79"
CYAN, WHITE, MUTED, PURPLE = "#44cafa", "#effaff", "#8ca8bc", "#b28bff"
FONT = ROOT / "public/fonts/NanumGothic-Regular.ttf"

# An original 6 x 3 m two-room plan: double walls, windows, door swings,
# partitions and furniture. There is no project/customer information in it.
segments = []
def seg(a, b, layer="WALL"):
    segments.append((a, b, layer))
def box(x, y, w, h, layer="WALL"):
    for a, b in [((x,y),(x+w,y)),((x+w,y),(x+w,y+h)),((x+w,y+h),(x,y+h)),((x,y+h),(x,y))]:
        seg(a,b,layer)
box(0,0,6000,3000)
box(150,150,5700,2700)
for x in (2900,3050):
    seg((x,150),(x,1050)); seg((x,1800),(x,2850))
for y in (1400,1550):
    seg((3050,y),(3900,y)); seg((4700,y),(5850,y))
for x in (600,1300,1850,4400,5100):
    seg((x,0),(x,150),"WINDOW")
seg((600,75),(1850,75),"WINDOW"); seg((4400,75),(5100,75),"WINDOW")
for x,y,w,h in [(450,1800,1500,650),(650,450,1100,600),(3750,1950,1500,650),(5100,350,500,650)]:
    box(x,y,w,h,"FURNITURE")
box(500,1850,1400,150,"FURNITURE"); box(3800,2000,1400,150,"FURNITURE")
for x,y in [(0,0),(0,2850),(5850,0),(5850,2850)]: box(x,y,150,150,"COLUMN")
def world(p): return (140+p[0]*.08,364-p[1]*.08)
A, B = world((0,3000)), world((6000,3000))

class Canvas:
    def __init__(self):
        self.im=Image.new("RGB",(W*S,H*S),BG); self.d=ImageDraw.Draw(self.im)
    def line(self,points,fill=WHITE,width=1):
        self.d.line([(round(x*S),round(y*S)) for x,y in points], fill=fill,width=max(1,round(width*S)),joint="curve")
    def rect(self,b,fill=None,outline=None,width=1,r=0):
        self.d.rounded_rectangle(tuple(round(v*S) for v in b),radius=round(r*S),fill=fill,outline=outline,width=max(1,round(width*S)))
    def circle(self,x,y,r,fill=None,outline=None,width=1):
        self.d.ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill=fill,outline=outline,width=max(1,round(width*S)))
    def text(self,x,y,text,size=14,fill=WHITE,anchor="la"):
        self.d.text((round(x*S),round(y*S)),str(text),font=ImageFont.truetype(str(FONT),round(size*S)),fill=fill,anchor=anchor)
    def result(self): return self.im.resize((W,H),Image.Resampling.LANCZOS)

def icon(c,name,x,y,color=MUTED,size=22):
    k=size/24
    def line(p): c.line([(x+a*k,y+b*k) for a,b in p],color,1.7)
    if name=="measure":
        line([(3,16),(16,3),(22,9),(9,22),(3,16)])
        for a,b in [(8,11),(12,7),(16,3)]: line([(a,b),(a+3,b+3)])
    elif name=="draw":
        line([(3,19),(8,7),(15,14),(22,3)])
        for a,b in [(3,19),(8,7),(15,14),(22,3)]: c.circle(x+a*k,y+b*k,1.5,color)
    elif name=="takeoff":
        for off in (0,5,10): line([(2,7+off),(12,2+off),(22,7+off),(12,12+off),(2,7+off)])
    elif name=="select": line([(5,2),(7,22),(13,15),(21,13),(5,2)])
    elif name=="undo": line([(8,3),(2,9),(8,15),(2,9),(15,9),(21,14),(20,20),(12,23)])
    elif name=="check": line([(3,12),(9,18),(21,5)])
    elif name=="close": line([(5,5),(19,19)]); line([(19,5),(5,19)])
    elif name=="eye":
        line([(2,12),(6,7),(12,5),(18,7),(22,12),(18,17),(12,19),(6,17),(2,12)])
        c.circle(x+12*k,y+12*k,3,None,color,1.4)

def hand(c,x,y,phase=1):
    # Index fingertip is the contact; the actual CAD point stays 48 px above it.
    skin="#d7e8f4"; edge="#7398b4"
    c.circle(x,y,17+phase*5,None,CYAN,1)
    c.d.polygon([(round((x+a)*S),round((y+b)*S)) for a,b in
        [(-7,37),(-7,3),(-4,-3),(2,-5),(8,0),(9,29),(16,24),(24,27),(29,33),(36,32),(43,39),(45,67),(34,91),(5,91),(-12,71),(-21,49),(-20,42),(-14,39),(-7,46)]],fill=skin)
    c.line([(x+a,y+b) for a,b in [(-7,37),(-7,3),(-4,-3),(2,-5),(8,0),(9,29),(16,24),(24,27),(29,33),(36,32),(43,39),(45,67),(34,91),(5,91),(-12,71),(-21,49),(-20,42),(-14,39),(-7,46)]],edge,1.6)
    c.line([(x+17,y+34),(x+18,y+51)],edge,1); c.line([(x+29,y+39),(x+29,y+54)],edge,1)
    c.line([(x-2,y+7),(x+4,y+7)],"#a7c4d8",1)

def dot(c,p,color=CYAN):
    c.circle(*p,6,None,color,1.5); c.circle(*p,1.8,WHITE)

def bubble(c,x,y,text,color=CYAN):
    width=max(105,len(text)*9+22)
    c.rect((x-width/2,y-16,x+width/2,y+16),NAVY,color,1,r=8);c.text(x,y,text,17,WHITE,"mm")

def base(mode="measure",layer="1"):
    c=Canvas()
    c.rect((0,0,800,36),"#091f33"); c.text(18,18,"Arcad View",15,WHITE,"lm")
    c.text(150,18,"example-floor.dxf",13,MUTED,"lm");c.text(774,18,"DXF",11,CYAN,"rm")
    for x in range(60,800,40): c.line([(x,44),(x,418)],"#11202d",.4)
    for y in range(60,420,40): c.line([(12,y),(788,y)],"#11202d",.4)
    for a,b,kind in segments:
        color={"WALL":"#7794a7","COLUMN":"#acc9d7","WINDOW":"#6db4cb","FURNITURE":"#405c70"}[kind]
        c.line([world(a),world(b)],color,1 if kind!="COLUMN" else 2)
    # Door swings rendered from their true 750/800 mm quarter circles.
    for cx,cy,rad,start in [(3050,1050,750,90),(3900,1400,800,0)]:
        pts=[world((cx+rad*math.cos(math.radians(start+i)),cy+rad*math.sin(math.radians(start+i)))) for i in range(91)]
        c.line(pts,"#4c718b",.8);c.line([world((cx,cy)),pts[0]],"#4c718b",.8)
    c.text(*world((1200,1350)),"LIVING",12,"#58768c","mm")
    c.text(*world((4500,2400)),"BED",12,"#58768c","mm")
    c.text(*world((4300,700)),"BATH",12,"#58768c","mm")
    c.line([(140,96),(620,96)],"#355468",.7)
    for x in (140,620): c.line([(x,91),(x,112)],"#355468",.7)
    c.text(380,86,"6,000",11,MUTED,"mm")
    c.rect((15,52,49,86),CYAN,"#b5edff",1,r=8); c.text(32,69,layer,18,"#092238","mm")
    c.rect((232,436,568,491),NAVY,LINE,1,r=12)
    for i,name in enumerate(["measure","draw","takeoff","select"]):
        x=246+i*65
        if name==mode:c.rect((x,442,x+58,485),"#087fe2",r=8)
        icon(c,name,x+18,451,WHITE if name==mode else MUTED)
    c.line([(507,449),(507,478)],LINE,1);icon(c,"close",525,451,CYAN)
    c.rect((15,383,52,427),NAVY,LINE,1,r=9);icon(c,"undo",23,393)
    return c

def magnifier(c,p):
    px,py=p
    # Match the actual lens: magnify CAD detail, not the UI point-ring width.
    region=base().im.crop((int((px-21)*S),int((py-14)*S),int((px+21)*S),int((py+14)*S)))
    region=region.resize((150*S,100*S),Image.Resampling.BICUBIC)
    c.im.paste(region,(630*S,54*S));c.rect((628,52,782,156),None,CYAN,1.3,r=10)
    c.circle(705,104,6,None,CYAN,1);c.circle(705,104,1.5,WHITE)
    c.rect((752,57,778,76),NAVY,r=4);c.text(765,66,"5×",10,CYAN,"mm")

def totals(c,value="3.600",color=CYAN):
    c.rect((637,177,782,248),NAVY,LINE,1,r=10)
    c.text(649,190,"Σ  [LAYER]",10,MUTED)
    c.circle(652,222,3,color);c.text(771,222,value+" m³",17,color,"rm")

def lesson_measure(t):
    c=base()
    if t>=1:
        dot(c,A)
    if 1<=t<3.6:
        magnifier(c,A);hand(c,A[0],A[1]+48,math.sin(t*5)**2)
    if 3.6<=t<4.4:
        u=(t-3.6)/.8;u=u*u*(3-2*u);p=(A[0]+(B[0]-A[0])*u,A[1])
        c.line([A,p],WHITE,1.4);dot(c,p);magnifier(c,p);hand(c,p[0],p[1]+48,.1)
    if t>=4.4:
        c.line([A,B],WHITE,1.4);dot(c,A);dot(c,B)
        if t<7:
            magnifier(c,B);hand(c,B[0],B[1]+48,math.sin(t*5)**2)
        else:
            bubble(c,380,164,"6,000 mm")
            c.circle(380,405,12,"#103d39");icon(c,"check",371,396,"#77dfc4",18)
    return c.result()

def lesson_takeoff(t):
    c=base("takeoff");totals(c,"0.000" if t<9 else "3.600")
    if t>=1:dot(c,A)
    if 1<=t<3: magnifier(c,A);hand(c,A[0],A[1]+48,math.sin(t*5)**2)
    if t>=3.6:
        c.line([A,B],"#061422",5);c.line([A,B],CYAN,3);c.line([A,B],WHITE,1);dot(c,A);dot(c,B)
    if 3.6<=t<5.2:hand(c,B[0],B[1]+48,math.sin(t*5)**2)
    if 5.2<=t<6.2:
        c.rect((66,386,139,422),"#087fe2",r=8);icon(c,"check",89,393,WHITE)
        hand(c,105,401,.1)
    if 6.2<=t<9:
        c.rect((232,146,568,349),NAVY,"#5487aa",1,r=13)
        c.text(253,166,"WALL",14,CYAN)
        for y,label,value in [(207,"H","3.00 m"),(261,"T","200 mm")]:
            c.text(253,y,label,16,MUTED,"lm");c.rect((309,y-17,546,y+19),"#092033",LINE,1,r=6);c.text(528,y+1,value,20,WHITE,"rm")
        c.rect((407,301,546,334),"#087fe2",r=7);icon(c,"check",463,306,WHITE)
        if t>8:hand(c,481,318,.1)
    if t>=9:
        bubble(c,380,164,"3.600 m³");c.text(380,393,"6.00 × 3.00 × 0.20",16,CYAN,"mm")
    return c.result()

def lesson_layers(t):
    second=t>=5.3; hidden=t>=7.7;c=base("takeoff","2" if second else "1")
    if not hidden:
        c.line([A,B],CYAN,3);dot(c,A);dot(c,B)
    slab=[world(p) for p in [(3100,1600),(5800,1600),(5800,2800),(3100,2800),(3100,1600)]]
    c.d.polygon([(round(x*S),round(y*S))for x,y in slab],fill="#222239")
    c.line(slab,PURPLE,2)
    totals(c,"0.583" if second else "3.600",PURPLE if second else CYAN)
    if 1<=t<2.4:hand(c,32,70,.1)
    if 2.4<=t<9.2:
        c.rect((67,54,373,333),NAVY,"#5487aa",1,r=12)
        icon(c,"takeoff",85,70,CYAN);icon(c,"close",335,69)
        c.rect((82,107,223,142),"#163a55",r=6);c.text(153,125,"DRAW",12,MUTED,"mm")
        c.rect((228,107,358,142),"#087fe2",r=6);c.text(293,125,"TAKEOFF",12,WHITE,"mm")
        for i,(title,value,col) in enumerate([("A · 1–2","3.600",CYAN),("B · 3–5","0.583",PURPLE)]):
            y=160+i*70;selected=second==(i==1)
            c.rect((82,y,358,y+62),"#173e58" if selected else "#102b42",col if selected else LINE,1,r=7)
            c.circle(99,y+19,3,col);c.text(112,y+12,title,14,WHITE)
            c.text(112,y+35,value+" m³",12,col)
            icon(c,"eye",323,y+20,MUTED if hidden and i==0 else WHITE,20)
            if hidden and i==0:c.line([(322,y+18),(345,y+43)],MUTED,1.4)
        if 2.5<=t<4:hand(c,293,125,.1)
        if 4.4<=t<6.4:hand(c,207,252,.1)
        if 6.7<=t<8.5:hand(c,334,191,.1)
    if t>=9.2:
        bubble(c,480,188,"0.583 m³",PURPLE)
    return c.result()

metadata={}
for name,seconds,draw in [("measure",10,lesson_measure),("takeoff",12,lesson_takeoff),("layers",11,lesson_layers)]:
    frames=[draw(i/10) for i in range(seconds*10)]
    # One stable palette prevents line shimmer and keeps all three lessons small.
    swatch=Image.new("RGB",(W,H*5))
    for i,n in enumerate([0,len(frames)//4,len(frames)//2,len(frames)*3//4,len(frames)-1]):swatch.paste(frames[n],(0,H*i))
    palette=swatch.quantize(colors=128,method=Image.Quantize.MEDIANCUT)
    indexed=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
    path=OUT/(name+".gif")
    indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=100,loop=0,optimize=True,disposal=1)
    frames[-1].save(OUT/(name+"-poster.png"),optimize=True)
    with Image.open(path) as gif:
        duration=sum(gif.seek(i) or gif.info.get("duration",0) for i in range(gif.n_frames))
        metadata[name]={"width":W,"height":H,"durationMs":duration,"frames":gif.n_frames,"bytes":path.stat().st_size}

dxf=["0","SECTION","2","HEADER","9","$INSUNITS","70","4","0","ENDSEC","0","SECTION","2","ENTITIES"]
for a,b,layer in segments:
    dxf += ["0","LINE","8",layer,"10",str(a[0]),"20",str(a[1]),"11",str(b[0]),"21",str(b[1])]
for cx,cy,rad,start in [(3050,1050,750,90),(3900,1400,800,0)]:
    dxf += ["0","ARC","8","DOOR","10",str(cx),"20",str(cy),"40",str(rad),"50",str(start),"51",str(start+90)]
dxf += ["0","ENDSEC","0","EOF"]
(OUT/"sample-floor-plan.dxf").write_text("\n".join(dxf)+"\n",encoding="utf-8")
(OUT/"manifest.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf-8")
print(json.dumps(metadata,indent=2))
