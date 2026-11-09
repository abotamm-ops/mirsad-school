from pathlib import Path
import gzip,zlib,struct,zipfile
root=Path(__file__).resolve().parents[2]
for edition,source in [('Shared','guardian-compatible'),('Schools','guardian-schools')]:
 s=(root/'schools'/source/'MirsadChromeGuardian.ps1').read_text(encoding='utf-8-sig')
 a=s.index('public static void KeepWorkspace(');b=s.index('[DllImport("user32.dll",CharSet',a)
 s=s[:a]+s[b:]
 a=s.index('if(dashboard!=null && teams!=null && Interlocked.Read');b=s.index('return result;',a)
 s=s[:a]+s[b:]
 s=s.replace('if($script:watched -ne [IntPtr]::Zero -and [MirsadChromeWindow]::IsWindow($script:watched)){[MirsadChromeWindow]::KeepWorkspace($script:watched,$form.Handle)}','')
 s=s.replace('[MirsadChromeWindow]::Pin($script:watched);[MirsadChromeWindow]::KeepWorkspace($script:watched,$form.Handle)','[MirsadChromeWindow]::Unpin($script:watched)')
 s=s.replace('[MirsadChromeTabs]::GuardHandle=$handle.ToInt64()','[MirsadChromeTabs]::GuardHandle=0')
 s=s.replace('$form.MaximizeBox = $false; $form.TopMost = $true','$form.MaximizeBox = $false; $form.TopMost = $false')
 s=s.replace('$timer.Interval = 500','$timer.Interval = 2000')
 s=s.replace('حماية مرصاد وتيمز','متابعة فتح مرصاد').replace('الحماية تعمل على نافذة كروم التي تحتوي مرصاد','مرصاد مفتوح — لا يتم تغيير التركيز')
 s=s.replace('مرصاد: نفس نافذة مدرستي وتيمز','مرصاد: متابعة فتح الصفحة')
 s=s.replace('ستبقى نافذة الرصد مكبّرة وفي المقدمة. يُعاد فتح مرصاد إذا أغلقته ويُعرض تيمز الموجود في نافذته.','يعيد المساعد فتح مرصاد إذا أغلقته فقط. يمكنك تصغير النوافذ وفتح أي برنامج. لا يغيّر تبويب تيمز ولا يثبّت كروم في المقدمة.')
 assert 'KeepWorkspace' not in s and '::Pin(' not in s and '((SelectionItemPattern)t).Select()' not in s
 script=b'\xef\xbb\xbf'+s.encode()
 # Preserve the proven Windows launcher; replace only its fixed-size embedded gzip resource.
 old=root/'schools/downloads'/f'Mirsad-{edition}-Guardian-3.4.1.zip'
 with zipfile.ZipFile(old) as z: original=z.read('MirsadChromeGuardian/MirsadChromeGuardian.exe')
 off=original.index(b'\x1f\x8b\x08',900000);d=zlib.decompressobj(31);d.decompress(original[off:]);size=len(original[off:])-len(d.unused_data)
 payload=gzip.compress(script,compresslevel=9,mtime=0);assert len(payload)<=size
 pad=size-len(payload)
 if pad:payload=payload[:3]+bytes([payload[3]|16])+payload[4:10]+b' '*(pad-1)+b'\0'+payload[10:]
 assert gzip.decompress(payload)==script
 exe=original[:off]+payload+original[off+size:]
 assert len(exe)==len(original) and exe[:off]==original[:off] and exe[off+size:]==original[off+size:]
 (root/'schools/guardian-reopen'/f'{edition}.ps1').write_bytes(script)
 out=root/'schools/downloads'/f'Mirsad-{edition}-Guardian-3.4.2.zip'
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('MirsadChromeGuardian/MirsadChromeGuardian.exe',exe)
  z.writestr('MirsadChromeGuardian/اقرأ.txt','مساعد مرصاد 3.4.2\nأغلق المساعد القديم أولاً: Ctrl+Shift+Q.\nفك الضغط بالكامل وشغل MirsadChromeGuardian.exe فقط.\nيعيد فتح مرصاد عند إغلاقه فقط، ولا يمنع البرامج الأخرى ولا يغير تبويب تيمز.\nإيقاف: يوقف المتابعة. تشغيل: يستأنفها. إغلاق: ينهي المساعد ويترك كروم مفتوحاً.\nCtrl+Shift+P إيقاف / Ctrl+Shift+M تشغيل / Ctrl+Shift+Q إغلاق.\n')
 print(out)
