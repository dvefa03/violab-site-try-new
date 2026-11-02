import re, json, math, random
import numpy as np
from PIL import Image, ImageDraw
exec(open('prep.py').read().split("walls=layer")[0])  # reuse parse helpers
walls=layer("L-walls"); doors=layer("L-doors")
PX=16; Wm=3131*0.05; Hm=1038*0.05
W,H=int(Wm*PX)+1,int(Hm*PX)+1
wall=Image.new('L',(W,H),0); d=ImageDraw.Draw(wall)
def draw(polys,width):
    for q in polys:
        pts=[(x*0.05*PX,y*0.05*PX) for x,y in q]
        if len(pts)>1: d.line(pts,fill=255,width=width)
draw(walls,3); 
doorm=Image.new('L',(W,H),0); dd=ImageDraw.Draw(doorm)
for q in doors:
    pts=[(x*0.05*PX,y*0.05*PX) for x,y in q]
    if len(pts)>1: dd.line(pts,fill=255,width=2)
block=np.maximum(np.array(wall),np.array(doorm))>0
# label rooms by flood fill
from collections import deque
lab=np.full((H,W),-1,np.int32); lab[block]=-2
def fill(x,y,v):
    if not(0<=x<W and 0<=y<H) or lab[y,x]!=-1: return 0
    q=deque([(x,y)]); lab[y,x]=v; n=0
    while q:
        cx,cy=q.popleft(); n+=1
        for nx,ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
            if 0<=nx<W and 0<=ny<H and lab[ny,nx]==-1: lab[ny,nx]=v; q.append((nx,ny))
    return n
# outside from border
for x in range(0,W,3):
    fill(x,0,-3); fill(x,H-1,-3)
for y in range(0,H,3):
    fill(0,y,-3); fill(W-1,y,-3)
rooms=json.load(open('/mnt/user-data/uploads/rooms.json'))
def kind(name):
    n=name.lower()
    if 'open office' in n or 'exhibit' in n or 'open lab' in n: return 'wood'
    if n.startswith('office') or n=='reception' or 'store-rc' in n: return 'wood2'
    if 'conf' in n or 'multi use' in n or 'projection' in n: return 'carpet'
    if 'toilet' in n or 'restroom' in n or 'janitor' in n: return 'bath'
    if n=='tea': return 'kitchen'
    if 'lab' in n: return 'labtile'
    if any(k in n for k in ['corridor','lobby','hallway','prefunction','vestibule','reception']): return 'tile'
    return 'service'

sizes={}
ORDER=['wood','wood2','carpet','labtile','bath','kitchen','tile','service']
for i,r in sorted(enumerate(rooms),key=lambda t:ORDER.index(kind(t[1]['name']))):
    x,y=int(r['x']*PX),int(r['z']*PX)
    # nudge to free pixel
    for rad in range(0,12):
        done=False
        for dx in range(-rad,rad+1):
            for dy in range(-rad,rad+1):
                if 0<=x+dx<W and 0<=y+dy<H and lab[y+dy,x+dx]==-1:
                    sizes[i]=fill(x+dx,y+dy,i); done=True; break
                if 0<=x+dx<W and 0<=y+dy<H and lab[y+dy,x+dx]>=0: done=True; break
            if done: break
        if done: break
print('outside frac',(lab==-3).mean(),'unassigned',(lab==-1).mean())
K=np.full((H,W),'',dtype=object)
img=np.zeros((H,W,4),np.uint8)
yy,xx=np.mgrid[0:H,0:W]
rnd=np.random.default_rng(3).random((H,W))
def pat(k):
    if k=='wood':
        row=(yy//5); off=(row*13)%23; seam=((xx+off)%24==0)|(yy%5==0)
        base=np.where((row%3)==0,[205,164,112],np.where((row%3)==1,[196,153,101],[211,171,121])) if False else None
        c=np.zeros((H,W,3)); shade=(row%3)[...,None]
        c[:]= [204,160,108]; c+= (shade-1)*7; c+= (rnd[...,None]-0.5)*6
        c[seam]=[170,124,78]; return c
    if k=='wood2':
        row=(yy//5); off=(row*11)%19; seam=((xx+off)%20==0)|(yy%5==0)
        c=np.zeros((H,W,3)); c[:]=[222,190,145]; c+=((row%3)[...,None]-1)*6; c+=(rnd[...,None]-0.5)*6
        c[seam]=[190,154,108]; return c
    if k=='carpet':
        c=np.zeros((H,W,3)); c[:]=[126,146,186]; dots=((xx%6==0)&(yy%6==0))|((xx%6==3)&(yy%6==3))
        c[dots]=[150,168,205]; c+=(rnd[...,None]-0.5)*8; return c
    if k=='tile':
        chk=((xx//8+yy//8)%2==0); c=np.zeros((H,W,3)); c[:]=[232,229,220]; c[chk]=[222,218,207]
        c[(xx%8==0)|(yy%8==0)]=[205,200,188]; return c
    if k=='labtile':
        c=np.zeros((H,W,3)); c[:]=[206,228,224]; c[(xx%8==0)|(yy%8==0)]=[180,206,202]; return c
    if k=='bath':
        c=np.zeros((H,W,3)); c[:]=[226,236,242]; c[(xx%4==0)|(yy%4==0)]=[196,212,222]; return c
    if k=='kitchen':
        chk=((xx//4+yy//4)%2==0); c=np.zeros((H,W,3)); c[:]=[245,240,228]; c[chk]=[214,92,80]; return c
    c=np.zeros((H,W,3)); c[:]=[176,178,182]; c+=(rnd[...,None]-0.5)*10; return c
pats={k:pat(k) for k in ['wood','wood2','carpet','tile','labtile','bath','kitchen','service']}
out=np.zeros((H,W,3))
kmap={i:kind(r['name']) for i,r in enumerate(rooms)}
assigned=np.zeros((H,W),bool)
for i,k in kmap.items():
    m=lab==i
    out[m]=pats[k][m]; assigned|=m
rest=(lab==-1)|(lab==-2)
out[lab==-1]=pats['tile'][lab==-1]
# walls dark
wm=np.array(wall)>0
out[wm]=[58,62,74]
alpha=np.where(lab==-3,0,255).astype(np.uint8)
# door pixels: show floor (tile) not dark
dm=(np.array(doorm)>0)&~wm
out[dm]=pats['tile'][dm]
img=np.dstack([np.clip(out,0,255).astype(np.uint8),alpha])
from PIL import ImageFont
FONT=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',11)
def label(im,col):
    d=ImageDraw.Draw(im)
    for r in rooms:
        if r['number'].startswith('25'): continue           # lift cars
        x,y=r['x']*PX,r['z']*PX; t=r['number']
        w=d.textlength(t,font=FONT); d.text((x-w/2,y-6),t,font=FONT,fill=col,stroke_width=2,stroke_fill=(255,255,255,200))
    return im
Image.fromarray(img,'RGBA').save('floor.png',optimize=True)
LBL=Image.new('RGBA',(W,H),(0,0,0,0)); label(LBL,(30,34,60,235))
# desk numbers (ws01, ws19 ...) next to each workplace, smaller and in violet
SF=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',8)
dd=ImageDraw.Draw(LBL)
for w in json.load(open('/mnt/user-data/uploads/workplaces.json')):
    if not w['seat']: continue
    x,y=w['x']*PX,w['z']*PX; t=w['seat']; tw=dd.textlength(t,font=SF)
    dd.text((x-tw/2,y-4),t,font=SF,fill=(91,95,199,255),stroke_width=2,stroke_fill=(255,255,255,220))
LBL.save('labels.png',optimize=True)
# toy style: flat soft colors per room, light walls
TOY={'wood':(235,221,194),'wood2':(241,230,207),'carpet':(207,221,243),'tile':(228,229,224),'labtile':(198,230,214),'bath':(214,230,238),'kitchen':(242,217,204),'service':(214,216,221)}
toy=np.zeros((H,W,3)); toy[:]=TOY['tile']
for i,k in kmap.items(): toy[lab==i]=TOY[k]
toy[wm]=[134,170,219]
toy[dm]=TOY['tile']
Image.fromarray(np.dstack([toy.astype(np.uint8),alpha]),'RGBA').save('floor_toy.png',optimize=True)
json.dump({str(i):kmap[i] for i in kmap},open('kinds.json','w'))
print(W,H)
