"""Real screenshot handler -> durable outbox -> compiled native host -> actual fixture disks.
Uses temporary Linux directories for G/K/C, never accesses real user drives or Google.
"""
from pathlib import Path
import base64,json,struct,subprocess,tempfile,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
HOST=Path('/tmp/mirsad-backup-integration')
if not HOST.exists():raise SystemExit('Build the fixture host first: go -C local-backup-host build -o /tmp/mirsad-backup-integration .')
expected={}
with tempfile.TemporaryDirectory(prefix='mirsad-capture-',dir='/tmp') as fixture:
 disk=Path(fixture)
 for drive in ['G:\\','K:\\','C:\\']:(disk/drive).mkdir()
 def native(_source,message):
  
  if message.get('image'):expected[message['record']['scanId']]=base64.b64decode(message['image'].split(',')[1])
  body=json.dumps(message,ensure_ascii=False).encode();out=subprocess.run([str(HOST)],cwd=disk,input=struct.pack('<I',len(body))+body,capture_output=True,check=True,timeout=9).stdout
  n=struct.unpack('<I',out[:4])[0];return json.loads(out[4:4+n])
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context();ctx.route('https://mirsad-capture.invalid/**',lambda r:r.fulfill(body='<html></html>',content_type='text/html'))
  ctx.expose_binding('fixtureNative',native)
  def init(page):
   page.goto('https://mirsad-capture.invalid/')
   page.evaluate('''()=>{window.nativeOnline=true;window.fixtureStore=JSON.parse(localStorage.getItem('storage')||'{}');const noop={addListener(){}};window.importScripts=()=>{};window.chrome={runtime:{id:'a'.repeat(32),onStartup:noop,onInstalled:noop,onMessage:{addListener(fn){window.handler=fn}},sendNativeMessage(host,message,callback){if(!nativeOnline){this.lastError={message:'Specified native messaging host not found.'};callback();delete this.lastError;return}fixtureNative(message).then(callback,error=>{this.lastError={message:error.message};callback();delete this.lastError})}},storage:{onChanged:noop,local:{async get(){return structuredClone(fixtureStore)},async set(v){Object.assign(fixtureStore,structuredClone(v));localStorage.setItem('storage',JSON.stringify(fixtureStore))}}},tabs:{onCreated:noop,onRemoved:noop,async query(q){return q?.active?[{id:1,windowId:1}]:[]},async get(id){return {id,windowId:1,url:'https://teams.microsoft.com/v2/'}},async captureVisibleTab(){const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='#ddd';x.fillRect(0,0,900,500);x.fillStyle='#111';x.font='28px sans-serif';x.fillText('Teams evidence fixture',50,100);return c.toDataURL('image/png')}},alarms:{create(){},clear(){},onAlarm:noop},downloads:{download(){throw Error('Evidence must not go to Downloads')}}}}''')
   for name in ['schedule-core.js','monitor-model.js','drive-sync.js','local-backup.js','action-status.js','scan-activity.js','background.js']:page.add_script_tag(path=str(R/'teams-probe'/name))
  def capture(page,scan):
   return page.evaluate('''async scan=>{fixtureStore.mirsadAutoRun={running:true,current:{scanId:scan,teacher:'معلم الاختبار'},period:1,cycle:1,tabId:1};return new Promise(resolve=>handler({type:'MIRSAD_CAPTURE_EVIDENCE',teacher:'معلم الاختبار',status:'absent',period:1,scanId:scan,evidence:{verified:true,teacherInInvitees:true,teacherNotPresent:true,inviteesReadable:true}},{tab:{id:1,windowId:1}},resolve))}''',scan)
  page=ctx.new_page();init(page);assert capture(page,'first-scan')['ok']
  page.wait_for_function("async()=>{const info=await LocalBackup.info();return info.pendingImages===0&&fixtureStore.mirsadEvidenceRecords[0]?.localBackupPending===false}")
  day=page.evaluate('MirsadMonitorModel.day()')
  for drive in ['G:\\','K:\\']:
   files=list((disk/drive/'Data Copy'/('توثيق غياب '+day)).glob('*.png'));assert len(files)==1;assert files[0].read_bytes()==expected['first-scan']
  assert page.evaluate('fixtureStore.mirsadEvidenceRecords[0].evidenceVerified')
  page.evaluate('nativeOnline=false');assert capture(page,'offline-scan')['ok']
  page.wait_for_function("fixtureStore.mirsadLocalBackupStatus?.code==='host-not-installed'")
  info=page.evaluate('LocalBackup.info()');assert info['pendingImages']==1;assert info['capturedCount']==2
  page.close()
  for drive in ['G:\\','K:\\']:shutil.rmtree(disk/drive)
  page=ctx.new_page();init(page);page.evaluate('LocalBackup.check()')
  page.wait_for_function("async()=>{const info=await LocalBackup.info();return info.pendingImages===0&&fixtureStore.mirsadEvidenceRecords[1]?.localBackupPending===false}")
  recovered=list((disk/'C:\\'/'Data Copy'/('توثيق غياب '+day)).glob('*.png'));assert len(recovered)==1;assert recovered[0].read_bytes()==expected['offline-scan']
  assert not list(disk.rglob('Downloads'))
  b.close();print('PASS real captured PNGs written to both fixture drives; missing helper preserves image across restart; recovery writes C fallback without Downloads')
