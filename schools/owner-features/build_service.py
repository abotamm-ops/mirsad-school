from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--base',default='/workspace/mirsad-remote-controls/source/schools-remote.gs');p.add_argument('--out',default='/workspace/downloads/Mirsad-Schools-OWNER-ONLY-2.5.0.gs');args=p.parse_args()
here=Path(__file__).parent;s=Path(args.base).read_text()
needle=' return {\n  month,';assert needle in s
s=s.replace(needle,' return {\n'+(here/'registry-methods.js').read_text()+'  month,',1)
needle='recorderActivity(key){';assert needle in s;s=s.replace(needle,'recorderActivity(key,input={}){',1)
needle="s.device.lastSeen=now();track(s,'extensionDevices',input)" # logins are counted by original track, not fabricated usage.
needle="logins:prior?.logins||1};save(r)},";assert needle in s
s=s.replace(needle,"logins:prior?.logins||1};commercialUsageTouch_(v.school,'monitor',id,input.running===true&&['scanning','waiting'].includes(input.phase),now());save(r)},",1)
s=s.replace('registry.recorderActivity(p.key)', 'registry.recorderActivity(p.key,p)')
needle="logins:previous?.logins||1};save(r)}return {ok:true}},";assert needle in s
s=s.replace(needle,"logins:previous?.logins||1};if(typeof input.active==='boolean')commercialUsageTouch_(v.school,'website',id,input.active,now());save(r)}return {ok:true,settings:commercialOwnerSettingsPublic_(r)}},",1)
needle=" else if(p.action==='commercialListSchools')";assert needle in s
s=s.replace(needle," else if(p.action==='commercialOwnerPortal')result=registry.ownerPortal(p.key);\n else if(p.action==='commercialOwnerSettings')result=registry.ownerSettings(p.key,p.settings);\n else if(p.action==='commercialCustomerPortal')result=registry.customerPortal(p.key);\n else if(p.action==='commercialCustomerFeedback')result=registry.customerFeedback(p.key,p);\n"+needle,1)
s=s.replace("version:'2.4.1',remoteAutoLinks:true", "version:'2.5.0',ownerPortal:true,remoteAutoLinks:true")
s=s.replace("'commercialDriveStatus','getAutoLinksControl'].indexOf(action)","'commercialDriveStatus','getAutoLinksControl','commercialOwnerPortal','commercialCustomerPortal'].indexOf(action)")
s=s.replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.4.1','')
s+='\n'+(here/'service-helpers.gs').read_text()+'\n// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.5.0\n'
assert "ownerPortal:true" in s
Path(args.out).write_text(s);print('Built school owner service 2.5.0')
