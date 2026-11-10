from pathlib import Path
import zipfile,json,hashlib
base=Path('schools/downloads/Mirsad-Schools-2.3.3.6.zip');out=base.with_name('Mirsad-Schools-2.3.3.7.zip');folder=Path('/tmp/mirsad-schools-service-fix')
with zipfile.ZipFile(base) as a,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as b:
 for info in a.infolist():
  data=a.read(info.filename)
  if info.filename in ['الإضافة/background.js','الإضافة/drive-sync.js','الإضافة/madrasati-source.js']:data=(folder/info.filename.split('/')[-1]).read_bytes()
  if info.filename=='الإضافة/manifest.json':
   m=json.loads(data);m['version']='2.3.3.7';data=(json.dumps(m,ensure_ascii=False,indent=2)+'\n').encode()
  b.writestr(info,data)
 b.writestr('الإضافة/service-transport.js',(folder/'service-transport.js').read_bytes())
with zipfile.ZipFile(base) as a,zipfile.ZipFile(out) as b:
 assert b.testzip() is None
 assert set(b.namelist())-set(a.namelist())=={'الإضافة/service-transport.js'}
 changed={n for n in a.namelist() if a.read(n)!=b.read(n)}
 assert changed=={'الإضافة/background.js','الإضافة/drive-sync.js','الإضافة/madrasati-source.js','الإضافة/manifest.json'}
Path('schools/downloads/CHECKSUMS-SCHOOLS-2.3.3.7.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
print('PASS school JSON transport patch packaged; original helper and other extension files unchanged:',out)
