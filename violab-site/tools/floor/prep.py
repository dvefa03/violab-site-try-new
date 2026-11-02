import re, json, math
import numpy as np
from PIL import Image, ImageDraw
SVG='/mnt/user-data/uploads/B1-L2_plan_layers.svg'
s=open(SVG).read()
M=0.05
def parse_d(d):
    polys, x, y, cur, cmd = [], 0.0, 0.0, None, ""
    tok = re.findall(r"[MmLl]|-?\d*\.?\d+(?:e-?\d+)?", d)
    i = 0
    while i < len(tok):
        t = tok[i]
        if t in ("M","m","l","L"): cmd=t; i+=1; continue
        a,b=float(tok[i]),float(tok[i+1]); i+=2
        if cmd=="M": x,y=a,b; cur=[(x,y)]; polys.append(cur); cmd="l"
        elif cmd=="m": x+=a; y+=b; cur=[(x,y)]; polys.append(cur); cmd="l"
        elif cmd=="L": x,y=a,b; cur.append((x,y))
        else: x+=a; y+=b; cur.append((x,y))
    return polys
def layer(name):
    m=re.search(r'<g class="(?:layer )?%s">(.*?)</g>'%re.escape(name), s, re.S)
    out=[]
    for d in re.findall(r' d="([^"]*)"', m.group(1)): out+=parse_d(d)
    return out
walls=layer("L-walls"); doors=layer("L-doors"); furn=layer("L-furn"); other=layer("L-other")
print(len(walls),len(doors),len(furn),len(other))
def segs(polys):
    out=[]
    for q in polys:
        for a,b in zip(q,q[1:]):
            if abs(a[0]-b[0])+abs(a[1]-b[1])>0.3: out.append((a[0]*M,a[1]*M,b[0]*M,b[1]*M))
    return out
W=segs(walls); print('wall segs',len(W))
# seats
seats={}
for sid,d in re.findall(r'<path id="([^"]+)" class="seat" d="([^"]*)"',s):
    ps=[q for q in parse_d(d) if len(q)>1]
    seats[sid]=ps
print('seats',len(seats))
wp=json.load(open('/mnt/user-data/uploads/workplaces.json'))
def bbox(q):
    xs=[p[0] for p in q]; ys=[p[1] for p in q]; return min(xs),min(ys),max(xs),max(ys)
seatinfo=[]
for w in wp:
    e={"id":w["id"],"room":w["room"],"type":w["type"],"x":w["x"],"z":w["z"]}
    ps=seats.get(w["id"])
    if ps:
        # chair = closed subpath with smallest bbox area
        cands=[]
        for q in ps:
            b=bbox(q); A=(b[2]-b[0])*(b[3]-b[1])
            closed=len(q)>=4 and abs(q[0][0]-q[-1][0])<0.6 and abs(q[0][1]-q[-1][1])<0.6
            cands.append((A,closed,q))
        small=[c for c in cands if c[1] and 20<c[0]<260] or sorted(cands,key=lambda c:c[0])[:1]
        ch=min(small,key=lambda c:c[0])[2]
        cx=np.mean([p[0] for p in ch])*M; cz=np.mean([p[1] for p in ch])*M
        allp=[p for q in ps for p in q if q is not ch]
        dx=np.mean([p[0] for p in allp])*M-cx; dz=np.mean([p[1] for p in allp])*M-cz
        e.update(sx=round(cx,2),sz=round(cz,2),face=round(math.atan2(dx,dz),3))
    seatinfo.append(e)
print(seatinfo[0], seatinfo[-1])
# collision segments: walls + seats outlines + furniture
C=W+segs([q for ps in seats.values() for q in ps])+segs(furn)
json.dump({"walls":[[round(v,2) for v in t] for t in W],"collide":[[round(v,2) for v in t] for t in C],"seats":seatinfo},open('floor.json','w'))
print('collide',len(C))
