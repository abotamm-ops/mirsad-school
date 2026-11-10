from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[2];here=Path(__file__).parent
for edition in ['Shared','Schools']:
 s=(root/'schools/guardian-panel'/f'{edition}.ps1').read_text(encoding='utf-8-sig')
 s=s.replace('public static void FocusForOpen', (here/'restore.cs').read_text()+'\npublic static void FocusForOpen',1)
 s=s.replace('$script:launch = $null', '''$script:launch = $null
$script:hadWorkspace=$false
$script:restoreTried=$false
$script:restoreUntil=[DateTime]::MinValue
$script:restoreTarget=[IntPtr]::Zero
'''+(here/'restore.ps1').read_text(),1)
 s=s.replace('$script:watched = $handle', '''$script:hadWorkspace=$true
$script:restoreTried=$false
$script:restoreTarget=[IntPtr]::Zero
$script:restoreUntil=[DateTime]::MinValue
$script:watched = $handle''',1)
 s=s.replace('$launch = Get-GuardianLaunch\nif ($windows -contains', '''$launch = Get-GuardianLaunch
if(Restore-GuardianWorkspace -Windows $windows -Inventory $inventory -Launch $launch){$stateLabel.Text='جارٍ استرجاع تبويبات نافذة الرصد المغلقة';return}
if ($windows -contains''',1)
 s=s.replace('$script:pending=$false\nif($script:watched', '''$script:pending=$false
$script:restoreTried=$false;$script:restoreTarget=[IntPtr]::Zero;$script:restoreUntil=[DateTime]::MinValue
if($script:watched''',1)
 s=s.replace('يُعاد فتح مرصاد إذا أغلقته','يسترجع تبويبات كروم المغلقة عند إغلاق نافذة الرصد ثم يتحقق من وجود مرصاد')
 assert 'Restore-GuardianWorkspace -Windows' in s
 (here/f'{edition}.ps1').write_bytes(b'\xef\xbb\xbf'+s.encode())
 build=Path('/tmp/mirsad-guardian-session-build')/edition;build.mkdir(parents=True,exist_ok=True)
 for name in ['go.mod','launcher.go','launcher_windows.go','launcher_test.go','rsrc_windows_amd64.syso']:
  shutil.copy2(root/'chrome-guardian'/name,build/name)
 (build/'MirsadChromeGuardian.ps1').write_bytes(b'\xef\xbb\xbf'+s.encode())
 print(build)
