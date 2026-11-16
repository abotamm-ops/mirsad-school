from pathlib import Path
import base64,json,secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1];work=Path('/tmp/mirsad-commercial');version='2.9.44';name='owner-script-'+version;linkfile=work/('OWNER-'+version+'-LINK.txt')
key=base64.urlsafe_b64decode(linkfile.read_text().strip().split('#')[1]+'=') if linkfile.exists() else secrets.token_bytes(32)
nonce=secrets.token_bytes(12);data=(work/('owner-'+version+'.gs')).read_bytes();cipher=AESGCM(key).encrypt(nonce,data,None)
assert AESGCM(key).decrypt(nonce,cipher,None)==data
(root/'schools'/(name+'.encrypted.json')).write_text(json.dumps({'nonce':base64.b64encode(nonce).decode(),'data':base64.b64encode(cipher).decode()}))
for ext in ['html','preview.js']:
 suffix='.html' if ext=='html' else '-preview.js'
 original=root/'schools'/('owner-script-2.9.38'+suffix)
 (root/'schools'/(name+suffix)).write_text(original.read_text().replace('2.9.38',version))
linkfile.write_text('https://mirsad-school.onrender.com/schools/'+name+'.html#'+base64.urlsafe_b64encode(key).decode().rstrip('=')+'\n')
print('Packaged encrypted owner service 2.9.44; key retained privately')
