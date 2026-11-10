from pathlib import Path
import zipfile,json,hashlib
root=Path('schools/downloads');checks=[]
for kind,old,new in [('Teams','0.6.81.1','0.6.81.6'),('Schools','2.3.3.1','2.3.3.6')]:
 source=root/f'Mirsad-{kind}-{old}.zip';target=root/f'Mirsad-{kind}-{new}.zip'
 patch=Path('/tmp/stable-link-'+kind+'/drive-sync.js').read_bytes()
 with zipfile.ZipFile(source) as a,zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as b:
  for info in a.infolist():
   data=a.read(info.filename)
   if info.filename=='الإضافة/drive-sync.js':data=patch
   if info.filename=='الإضافة/background.js':data=Path('/tmp/stable-link-'+kind+'/background.js').read_bytes()
   if info.filename=='الإضافة/manifest.json':
    m=json.loads(data);m['version']=new;data=(json.dumps(m,ensure_ascii=False,indent=2)+'\n').encode()
   b.writestr(info,data)
 with zipfile.ZipFile(source) as a,zipfile.ZipFile(target) as b:
  changes=[n for n in a.namelist() if a.read(n)!=b.read(n)]
  assert set(changes)=={'الإضافة/drive-sync.js','الإضافة/background.js','الإضافة/manifest.json'}
  assert b.testzip() is None
 checks.append(hashlib.sha256(target.read_bytes()).hexdigest()+'  '+target.name)
 print('PASS only sync fix and extension version changed:',target)
(root/'CHECKSUMS-LIVE-LINKS-2026-11-10.txt').write_text('\n'.join(checks)+'\n')
