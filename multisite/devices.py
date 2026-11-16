"""Upgrade legacy recorder authorization to independent device registrations."""
def transform(s):
 def replace(old,new):
  nonlocal s
  assert old in s,old[:100]
  s=s.replace(old,new)
 # s.device remains the request-local compatibility pointer; devices is canonical.
 replace(' function month(stamp)', ''' function registered(s){if(!s.devices)s.devices=s.device?[s.device]:[];return s.devices}
 function chooseDevice(s,key){s.device=registered(s).find(d=>same(d.writerToken,key))||null;return s.device}
 function registerDevice(s,input){const devices=registered(s),old=devices.find(d=>same(d.id,input.deviceId));if(old&&!same(old.secretHash,a.hash(input.deviceSecret)))fail('هوية الجهاز غير صحيحة؛ أعد تفعيل الإضافة','device-proof');s.device=old||{id:input.deviceId,secretHash:a.hash(input.deviceSecret),writerToken:token('w.'+s.id),at:now(),label:String(input.deviceLabel||'جهاز الرصد').slice(0,120)};if(!old)devices.push(s.device);s.device.lastSeen=now()}
 function revokeDevice(s,key){const current=registered(s).find(d=>same(d.writerToken,key));s.devices=registered(s).filter(d=>!same(d.writerToken,key));if(s.monitorLease?.deviceId===current?.id)s.monitorLease=null;s.device=s.devices[0]||null}
 function month(stamp)''')
 replace("if(role==='recorder'){if(!s.device", "if(role==='recorder'){chooseDevice(s,key);if(!s.device")
 replace("session?.writerHash&&(!s.device||!same(session.writerHash,a.hash(s.device.writerToken)))", "session?.writerHash&&!registered(s).some(d=>same(session.writerHash,a.hash(d.writerToken)))")
 replace('deviceRegistered:!!s.device,deviceLimit:1','deviceRegistered:registered(s).length>0,deviceLimit:null,registeredDeviceCount:registered(s).length')
 # Owner-wide resets revoke all registrations. Caller signout is replaced below.
 replace('s.device=null','s.devices=[];s.device=null')
 # Remove former single-device login rejection and attach verified device.
 lines=s.splitlines()
 for i,line in enumerate(lines):
  if line.startswith('  extensionCodeLogin('):
   start=line.index('if(s?.device&&');end=line.index('if(!s){',start)
   line=line[:start]+line[end:]
   start=line.index('if(!s.device)s.device=');end=line.index('track(s,',start)
   lines[i]=line[:start]+'registerDevice(s,input);'+line[end:]
  elif line.startswith('  extensionLogin('):
   start=line.index('if(s.device&&');end=line.index('track(s,',start)
   lines[i]=line[:start]+'registerDevice(s,input);'+line[end:]
  elif line.startswith('  enroll('):
   start=line.index('if(s.device&&');end=line.index('save(r);',start)
   lines[i]=line[:start]+'registerDevice(s,input);'+line[end:]
  elif line.startswith('  recorderStatus('):
   lines[i]=line.replace('s.device&&same(s.device.writerToken,input.key)','chooseDevice(s,input.key)')
  elif line.startswith('  recorderSignout('):
   lines[i]="  recorderSignout(input){this.recorderStatus(input);const r=load(),v=resolve(r,input.key);revokeDevice(v.school,input.key);save(r);return {loggedOut:true}},"
  elif line.startswith('  extensionLogout('):
   lines[i]=line.replace('v.school.device=null','revokeDevice(v.school,key)')
 s='\n'.join(lines)+'\n'
 replace("version:'2.9.44',multiSchoolAccounts:true", "version:'2.9.53',unlimitedRecorderDevices:true,multiSchoolAccounts:true")
 s=s.replace('singleExtensionSession:true','singleExtensionSession:false,singleMonitoringSession:true')
 return s
