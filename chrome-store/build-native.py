"""Build store-compatible Windows local archive and optional helper; no owner secrets."""
from pathlib import Path
import os,shutil,subprocess,zipfile,hashlib,struct
root=Path(__file__).resolve().parents[1]
go=os.environ.get('MIRSAD_GO','/tmp/rased-toolchain/go/bin/go')
work=Path('/tmp/rased-store-native');work.mkdir(exist_ok=True)
env={**os.environ,'GOCACHE':'/tmp/rased-gocache','GOPROXY':'off','GOOS':'windows','GOARCH':'amd64'}
for name in ['school-files.go','school-files_windows.go','video.go']:
 shutil.copy2(root/'schools/guardian-shared'/name,work/name)
shutil.copy2(root/'video/native-main_windows.go',work/'main_windows.go')
(work/'go.mod').write_text('module rased.local/store-files\n\ngo 1.23\n')
host=work/'MirsadSchoolFilesHost.exe'
subprocess.run([go,'build','-buildvcs=false','-trimpath','-ldflags=-H windowsgui -s -w','-o',str(host),'.'],cwd=work,env=env,check=True)
helperdir=work/'helper';helperdir.mkdir(exist_ok=True)
for name in ['go.mod','launcher.go','launcher_windows.go','rsrc_windows_amd64.syso']:
 shutil.copy2(root/'chrome-guardian'/name,helperdir/name)
p=helperdir/'launcher_windows.go';p.write_text(p.read_text().replace('HideWindow: true','HideWindow: false'))
shutil.copy2(root/'schools/guardian-session/Schools.ps1',helperdir/'MirsadChromeGuardian.ps1')
helper=helperdir/'MirsadChromeGuardian.exe'
subprocess.run([go,'build','-buildvcs=false','-trimpath','-ldflags=-H windowsgui -s -w','-o',str(helper),'.'],cwd=helperdir,env=env,check=True)
for binary in [host,helper]:
 data=binary.read_bytes();pe=struct.unpack_from('<I',data,0x3c)[0];assert data[pe:pe+4]==b'PE\0\0';assert struct.unpack_from('<H',data,pe+24+68)[0]==2
out=root/'schools/downloads/Rased-Schools-Store-Support-3.4.7.zip'
launcher='''Option Explicit
Dim shell,fso,base,result
Set shell=CreateObject("WScript.Shell")
Set fso=CreateObject("Scripting.FileSystemObject")
base=fso.GetParentFolderName(WScript.ScriptFullName)
result=shell.Run(Chr(34) & fso.BuildPath(base,"MirsadSchoolFilesHost.exe") & Chr(34) & " --install-native",0,True)
If result<>0 Then
 MsgBox "تعذر تثبيت مكوّن الحفظ المحلي. أغلق الرصد وحاول مجددًا.",48,"راصد"
 WScript.Quit result
End If
MsgBox "تم تجهيز الحفظ المحلي لنسخة المتجر والنسخة السابقة. افتح الإضافة واضغط فحص الحفظ المحلي. المساعد اختياري ويمكن تشغيله من الملف الموجود في هذا المجلد.",64,"راصد"
'''
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 z.write(host,host.name);z.write(helper,helper.name)
 z.writestr('تجهيز الحفظ المحلي.vbs',launcher.encode('utf-16'))
 z.writestr('تجهيز الحفظ المحلي.cmd','@echo off\r\n"%~dp0MirsadSchoolFilesHost.exe" --install-native\r\nif errorlevel 1 pause\r\n')
 z.writestr('اقرأ.txt',('دعم راصد المدارس 3.4.7\nاستخرج الحزمة كاملة. أوقف الرصد مؤقتًا، وشغّل تجهيز الحفظ المحلي.vbs مرة واحدة. بديل عند تعطيل VBScript: تجهيز الحفظ المحلي.cmd. بعدها افتح الإضافة وافحص الحفظ المحلي.\nالمكوّن يدعم النسخة السابقة ونسخة متجر كروم. لا يحذف ملفات الأرشيف ولا يغير حسابك.\nMirsadChromeGuardian.exe مساعد اختياري لتثبيت الصفحة واسترجاع جلسة كروم. أغلق المساعد السابق قبل تشغيله.\nتمت اختبارات منطق الحفظ والتحقق من بنية ملفات Windows على Linux؛ يلزم اختبار التثبيت والتواصل الفعلي على Windows قبل التوزيع العام.\n').encode('utf-8-sig'))
assert zipfile.ZipFile(out).testzip() is None
out.with_suffix('.sha256.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
print(out)
