from pathlib import Path
import zipfile
root=Path('/tmp/mirsad-schools-service-fix');root.mkdir(exist_ok=True)
with zipfile.ZipFile('schools/downloads/Mirsad-Schools-2.3.3.6.zip') as z:
 for n in z.namelist():
  if n.startswith('الإضافة/') and not n.endswith('/'):
   p=root/n[len('الإضافة/'):];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(n))
(root/'service-transport.js').write_bytes(Path('fixes/service-json/service-transport.js').read_bytes())
