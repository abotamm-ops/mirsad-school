from pathlib import Path
r=Path(__file__).resolve().parent
for edition,base in [('private','/workspace/mirsad-remote-controls/source/private-remote.gs'),('schools','/workspace/downloads/Mirsad-Schools-OWNER-ONLY-2.5.0.gs')]:
 s=Path(base).read_text()
 s=s.replace("'setSeventhPeriod','setAutoLinksControl']", "'setSeventhPeriod','setAutoLinksControl','videoConfigure']")
 s=s.replace("'scheduleVersions','getAutoLinksControl'].indexOf(p.action)","'scheduleVersions','getAutoLinksControl','videoStatus'].indexOf(p.action)")
 needle=" var root=monitorPrivate_(";pos=s.index(needle,s.index('function monitorRequest_(p)'))
 s=s[:pos]+" if(p.action.startsWith('video')){if(experimentId)throw new Error('الفيديو غير متاح في التجارب');return monitorVideoRequest_(p,props,monitorPrivate_(DriveApp.getFolderById(MONITOR_ROOT)),writer,siteReader)}\n"+s[pos:]
 adapter=(r/'service-adapter.gs').read_text()
 if edition=='schools':
  s=s.replace("'teachersLive','getAutoLinksControl'],writer=", "'teachersLive','getAutoLinksControl','videoStatus'],writer=")
  s=s.replace("'fillMissingLinks','addCalendarLinks'],admin=", "'fillMissingLinks','addCalendarLinks','videoPoll','videoUpdate','videoUploadBegin','videoUploadFinish'],admin=")
  s=s.replace("'reportSchedule','setAutoLinksControl'];", "'reportSchedule','setAutoLinksControl','videoConfigure'];")
  adapter=adapter.replace('drive=DriveApp,root=','drive=commercialSchoolDrive_(),root=')
  s=s.replace("version:'2.5.0',ownerPortal:true", "version:'2.6.11',videoRecording:true,ownerPortal:true")
  s=s.replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.5.0','')
 else:s=s.replace('// END MIRSAD PRIVATE REMOTE CONTROL 0.6.83','')
 s=s.replace("  var matches=root.getFoldersByName('توثيق غياب '+p.date);","  if(!experimentId)monitorVideoReset_(p.date,props,root,p.requestId);\n  var matches=root.getFoldersByName('توثيق غياب '+p.date);")
 s+='\n'+(r/'core.js').read_text()+'\n'+(r/'service-core.js').read_text()+'\n'+adapter
 s+='\n// END MIRSAD '+('SCHOOLS COMPLETE SCRIPT 2.6.11' if edition=='schools' else 'PRIVATE VIDEO SCRIPT 0.6.94')+'\n'
 (Path('/workspace/downloads')/('Mirsad-Schools-OWNER-ONLY-2.6.11.gs' if edition=='schools' else 'Mirsad-PRIVATE-VIDEO-0.6.94.gs')).write_text(s)
 print('Built separate '+edition+' video service')
