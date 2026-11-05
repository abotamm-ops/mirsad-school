"""Validate icon resources in the real Windows EXE, not merely a loose ICO file."""
from pathlib import Path
import struct
R=Path(__file__).resolve().parents[1]
b=(R/'chrome-guardian/MirsadChromeGuardian.exe').read_bytes()
pe=struct.unpack_from('<I',b,0x3c)[0];assert b[pe:pe+4]==b'PE\0\0'
opt=pe+24;assert struct.unpack_from('<H',b,opt)[0]==0x20b
assert struct.unpack_from('<H',b,opt+68)[0]==2
rva,size=struct.unpack_from('<II',b,opt+112+16);assert rva and size
sections=pe+24+struct.unpack_from('<H',b,pe+20)[0]
def raw(rva):
 for i in range(struct.unpack_from('<H',b,pe+6)[0]):
  sec=sections+i*40;vs,va,rs,rp=struct.unpack_from('<IIII',b,sec+8)
  if va<=rva<va+max(vs,rs):return rp+rva-va
 raise AssertionError('resource RVA outside sections')
base=raw(rva)
def directory(offset=0):
 count=sum(struct.unpack_from('<HH',b,base+offset+12));out={}
 for i in range(count):
  name,entry=struct.unpack_from('<II',b,base+offset+16+i*8);assert not name&0x80000000
  if entry&0x80000000:out[name]=directory(entry&0x7fffffff)
  else:
   addr,length=struct.unpack_from('<II',b,base+entry);out[name]=b[raw(addr):raw(addr)+length]
 return out
resources=directory();assert 3 in resources and 14 in resources
frames=[data for languages in resources[3].values() for data in languages.values()]
ico=(R/'chrome-guardian/assets/MirsadGuardian.ico').read_bytes();count=struct.unpack_from('<H',ico,4)[0];assert count==7
expected=[];sizes=[]
for i in range(count):
 start=6+i*16;width,height=ico[start],ico[start+1];sizes.append(width or 256)
 length,offset=struct.unpack_from('<II',ico,start+8);expected.append(ico[offset:offset+length])
assert sorted(sizes)==[16,24,32,48,64,128,256]
assert sorted(frames)==sorted(expected),'EXE icon differs from designed artwork'
print('PASS GUI executable contains all seven exact Mirsad icon frames, 16–256 px, plus group-icon resource')
