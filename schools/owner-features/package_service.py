from pathlib import Path
import base64,secrets,json,zipfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[2];site=root/'schools';out=Path('/workspace/downloads')
source=(out/'Mirsad-Schools-OWNER-ONLY-2.5.0.gs').read_bytes();key=secrets.token_bytes(32);nonce=secrets.token_bytes(12);cipher=AESGCM(key).encrypt(nonce,source,None)
assert AESGCM(key).decrypt(nonce,cipher,None)==source
(site/'owner-script-2.5.0.encrypted.json').write_text(json.dumps({'nonce':base64.b64encode(nonce).decode(),'data':base64.b64encode(cipher).decode()}))
for suffix in ['.html','-preview.js']:
 p=site/('owner-script-2.5.0'+suffix);p.write_text((site/('owner-script-2.4.1'+suffix)).read_text().replace('2.4.1','2.5.0'))
link='https://mirsad-school.onrender.com/schools/owner-script-2.5.0.html#'+base64.urlsafe_b64encode(key).decode().rstrip('=')
(out/'OWNER-SCRIPT-2.5.0-LINK.txt').write_text(link+'\n')
(out/'Mirsad-Schools-OWNER-ONLY-2.5.0.txt').write_bytes(source)
with zipfile.ZipFile(out/'Mirsad-Owner-Portal-2.5.0-SOURCE.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('service-base-2.4.1.gs',Path('/workspace/mirsad-remote-controls/source/schools-remote.gs').read_bytes())
 for p in (site/'owner-features').glob('*'):
  if p.is_file():z.write(p,'owner-features/'+p.name)
 z.writestr('Mirsad-Schools-OWNER-ONLY-2.5.0.gs',source)
print('PASS owner-only encryption and private source archive')
