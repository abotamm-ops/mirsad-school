
import zipfile,pathlib
for kind,version in [('Teams','0.6.81.1'),('Schools','2.3.3.1')]:
 p=pathlib.Path('/tmp/stable-link-'+kind);p.mkdir(exist_ok=True)
 with zipfile.ZipFile('schools/downloads/Mirsad-'+kind+'-'+version+'.zip') as z:
  (p/'drive-sync.js').write_bytes(z.read('الإضافة/drive-sync.js'))
