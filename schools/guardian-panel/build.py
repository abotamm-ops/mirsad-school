from pathlib import Path
import gzip,zlib,struct,zipfile
root=Path(__file__).resolve().parents[2]
for edition,source in [('Shared','guardian-compatible'),('Schools','guardian-schools')]:
 s=(root/'schools'/source/'MirsadChromeGuardian.ps1').read_text(encoding='utf-8-sig')
 # Never attach the GUI message queue to Chrome: a busy browser must not block Stop/Close.
 a=s.index('uint pid;var tid=GetWindowThreadProcessId(foreground');b=s.index('\n}',a)
 s=s[:a]+'BringWindowToTop(hwnd);SetForegroundWindow(hwnd);'+s[b:]
 s=s.replace('$script:watched = [IntPtr]::Zero\n$script:pending = $false', '$script:running = $false\n$script:exiting = $false\n$script:watched = [IntPtr]::Zero\n$script:pending = $false',1)
 a=s.index('$pauseButton.add_Click({');b=s.index('$tray = New-Object',a)
 s=s[:a]+'''function Stop-Guardian {
$script:running=$false
if($timer){$timer.Stop()}
[MirsadChromeTabs]::GuardHandle=0
$script:pending=$false
if($script:watched -ne [IntPtr]::Zero){[MirsadChromeWindow]::Unpin($script:watched)}
[MirsadChromeWindow]::KeepAwake($false)|Out-Null
$startButton.Enabled=$true
$stateLabel.Text='متوقف — الشاشة حرة'
if($tray){$tray.Text='مرصاد: متوقف'}
}
$pauseButton.add_Click({Stop-Guardian})
'''+s[b:]
 s=s.replace('$timer.add_Tick({\ntry {','$timer.add_Tick({\nif(-not $script:running -or $script:exiting){return}\ntry {')
 s=s.replace('$timer.Start()','$script:running=$true\n$timer.Start()')
 s=s.replace('if ($timer.Enabled) { return }','if ($script:running -or $script:exiting) { return }')
 a=s.index('$form.add_FormClosing(');b=s.index('$hotkeys = New-Object',a)
 s=s[:a]+'''$form.add_FormClosing({
$script:exiting=$true
Stop-Guardian
if($tray){$tray.Visible=$false}
})
'''+s[b:]
 a=s.index('$hotkeys.add_ExitRequested({');b=s.index('if(-not $hotkeys.Register())',a)
 s=s[:a]+'''$hotkeys.add_ExitRequested({$form.Close()})
'''+s[b:]
 s=s.replace('} catch {\n$timer.Stop();[MirsadChromeTabs]::GuardHandle=0','} catch {\nStop-Guardian\n$timer.Stop();[MirsadChromeTabs]::GuardHandle=0')
 s=s.replace('[DllImport("user32.dll")] static extern bool AttachThreadInput(uint a,uint b,bool attach);','').replace('[DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();','')
 s += '\nexit 0\n' 
 assert 'AttachThreadInput(own,tid,true)' not in s
 assert '$form.MinimizeBox=$true' in s and '$form.Hide()' not in s
 s='\n'.join(line.lstrip() for line in s.splitlines() if line.strip() and not line.lstrip().startswith('#'))+'\n'
 script=b'\xef\xbb\xbf'+s.encode()
 # Preserve the proven Windows launcher; replace only its fixed-size embedded gzip resource.
 old=root/'schools/downloads'/f'Mirsad-{edition}-Guardian-3.4.1.zip'
 with zipfile.ZipFile(old) as z: original=z.read('MirsadChromeGuardian/MirsadChromeGuardian.exe')
 off=original.index(b'\x1f\x8b\x08',900000);d=zlib.decompressobj(31);d.decompress(original[off:]);size=len(original[off:])-len(d.unused_data)
 candidates=[]
 for mem in range(1,10):
  for strategy in [zlib.Z_DEFAULT_STRATEGY,zlib.Z_FILTERED]:
   c=zlib.compressobj(9,zlib.DEFLATED,-15,mem,strategy);raw=c.compress(script)+c.flush()
   candidates.append(b'\x1f\x8b\x08\0\0\0\0\0\x02\xff'+raw+struct.pack('<II',zlib.crc32(script),len(script)))
 payload=min(candidates,key=len);assert len(payload)<=size,(len(payload),size)
 pad=size-len(payload)
 if pad:payload=payload[:3]+bytes([payload[3]|16])+payload[4:10]+b' '*(pad-1)+b'\0'+payload[10:]
 assert gzip.decompress(payload)==script
 exe=original[:off]+payload+original[off+size:]
 assert len(exe)==len(original) and exe[:off]==original[:off] and exe[off+size:]==original[off+size:]
 (root/'schools/guardian-panel'/f'{edition}.ps1').write_bytes(script)
 out=root/'schools/downloads'/f'Mirsad-{edition}-Guardian-3.4.3.zip'
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('MirsadChromeGuardian/MirsadChromeGuardian.exe',exe)
  z.writestr('MirsadChromeGuardian/اقرأ.txt','مساعد مرصاد 3.4.3\nأغلق المساعد القديم بـ Ctrl+Shift+Q قبل تشغيل هذه النسخة.\nفك الضغط بالكامل وشغل MirsadChromeGuardian.exe فقط.\nتشغيل: تثبيت نافذة الرصد في المقدمة وإعادة فتح مرصاد عند إغلاقه.\nإيقاف: تحرير الشاشة مع إبقاء اللوحة. تشغيل: استئناف.\nالخط: تصغير اللوحة إلى شريط المهام؛ لا يوقف الحماية.\nإغلاق أو × أو Ctrl+Shift+Q: إنهاء المساعد بالكامل مع إبقاء كروم مفتوحاً.\nCtrl+Shift+P إيقاف / Ctrl+Shift+M تشغيل.\n')
 print(out)
