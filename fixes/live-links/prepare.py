
import zipfile,pathlib
for kind,version in [('Teams','0.6.81.1'),('Schools','2.3.3.1')]:
 p=pathlib.Path('/tmp/stable-link-'+kind);p.mkdir(exist_ok=True)
 with zipfile.ZipFile('schools/downloads/Mirsad-'+kind+'-'+version+'.zip') as z:
  for entry in z.namelist():
   if entry.startswith('الإضافة/') and not entry.endswith('/'):
    target=p/entry[len('الإضافة/'):];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(entry))
