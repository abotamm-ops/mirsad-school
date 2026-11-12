from pathlib import Path
import zipfile,json,shutil
repo=Path(__file__).resolve().parents[1];here=repo/'video'
for label,old,new in [('Teams','0.6.81.6','0.6.101'),('Schools','2.3.3.7','2.6.18')]:
 out=Path('/tmp/mirsad-video-'+label);out.mkdir(exist_ok=True)
 with zipfile.ZipFile(repo/'schools/downloads'/f'Mirsad-{label}-{old}.zip') as z:
  for name in z.namelist():
   if name.startswith('الإضافة/') and not name.endswith('/'):
    p=out/name[len('الإضافة/'):];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name))
 (out/'video').mkdir(exist_ok=True)
 for name in ['core.js','store.js','disk.js','controller.js','offscreen.html','offscreen.js','meeting.js','popup.js']:shutil.copy2(here/name,out/'video'/name)
 p=out/'manifest.json';m=json.loads(p.read_text());m['version']=new;m['minimum_chrome_version']='120'
 for permission in ['tabCapture','offscreen']:
  if permission not in m['permissions']:m['permissions'].append(permission)
 for script in m['content_scripts']:
  if 'content.js' in script.get('js',[]):script['js'].append('video/meeting.js')
 m['host_permissions'].append('https://teams.cloud.microsoft/*')
 m['content_scripts'].append({'matches':['https://teams.cloud.microsoft/*'],'js':['video/meeting.js'],'run_at':'document_idle'})
 p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
 p=out/'content.js';p.write_text("(async()=>{try{const v=await chrome.runtime.sendMessage({type:'MIRSAD_VIDEO_IS_CAPTURE_TAB'});if(v?.capture===true)return}catch{}\n"+p.read_text()+"\n})()")
 p=out/'background.js';p.write_text("importScripts('video/core.js','video/store.js','video/disk.js','video/controller.js');\n"+p.read_text())
 p=out/'popup.html';s=p.read_text().replace('</body>','<script src="video/popup.js"></script></body>');s=s.replace('مرصاد · '+old.split('.')[0]+'.'+'.'.join(old.split('.')[1:3]),'مرصاد · '+new);p.write_text(s)
 print(out)
