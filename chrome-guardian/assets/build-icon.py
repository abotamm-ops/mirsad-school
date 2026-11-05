"""Generate original Mirsad radar artwork and Windows icon frames (Pillow only)."""
from pathlib import Path
from PIL import Image, ImageDraw
S=4
root=Path(__file__).resolve().parent
im=Image.new('RGBA',(256*S,256*S),(0,0,0,0))
mask=Image.new('L',im.size,0)
ImageDraw.Draw(mask).rounded_rectangle((0,0,256*S-1,256*S-1),radius=61*S,fill=255)
# Deep blue background with a restrained teal tint toward the top right.
for y in range(256*S):
 for x in range(256*S):
  t=(x+(256*S-y))/(512*S)
  im.putpixel((x,y),(int(8+6*t),int(26+23*t),int(44+18*t),255))
im.putalpha(mask)
d=ImageDraw.Draw(im)
def box(v):return tuple(int(n*S) for n in v)
d.rounded_rectangle(box((2,2,253,253)),radius=59*S,outline='#285164',width=2*S)
cx,cy=126,137
for r,color in [(84,'#276773'),(56,'#398E91'),(28,'#4CB8AD')]:
 d.ellipse(box((cx-r,cy-r,cx+r,cy+r)),outline=color,width=3*S)
d.polygon([box((126,137)),box((168,64)),box((205,104))],fill='#175954')
d.line([box((126,137)),box((183,80))],fill='#5CF0C8',width=7*S)
d.ellipse(box((116,127,136,147)),fill='#65F4CF')
d.ellipse(box((175,72,191,88)),fill='#C4FFED')
d.ellipse(box((179,76,187,84)),fill='#FFFFFF')
im=im.resize((256,256),Image.Resampling.LANCZOS)
im.save(root/'MirsadGuardian.png')
im.save(root/'MirsadGuardian.ico',sizes=[(n,n) for n in (16,24,32,48,64,128,256)])
