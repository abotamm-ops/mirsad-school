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
'''+(here/'preference.ps1').read_text()+f"\n$script:restoreModeFile=Join-Path $env:LOCALAPPDATA 'MirsadGuardian\\{edition}-restore-mode.txt'\n$script:restoreMode=Get-GuardianRestoreMode\n"+(here/'restore.ps1').read_text(),1)
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
 s=s.replace("'جارٍ التشغيل' 8 36 194 48", "'جارٍ التشغيل' 8 36 194 24")
 s=s.replace(" 8 91 62 37", " 8 96 62 37").replace(" 74 91 62 37", " 74 96 62 37").replace(" 140 91 62 37", " 140 96 62 37")
 marker="$exitButton.add_Click({$form.Close()})"
 choice='''$restoreModeChoice=New-Object System.Windows.Forms.ComboBox
$restoreModeChoice.SetBounds(8,62,194,26)
$restoreModeChoice.DropDownStyle='DropDownList'
$restoreModeChoice.Font=New-Object System.Drawing.Font('Segoe UI',9)
[void]$restoreModeChoice.Items.Add('مرصاد ومدرستي')
[void]$restoreModeChoice.Items.Add('مرصاد فقط')
$restoreModeChoice.SelectedIndex=if($script:restoreMode -eq 'dashboard'){1}else{0}
$restoreModeChoice.add_SelectedIndexChanged({
$script:restoreMode=if($restoreModeChoice.SelectedIndex -eq 1){'dashboard'}else{'session'}
$script:restoreTried=$false;$script:restoreTarget=[IntPtr]::Zero;$script:restoreUntil=[DateTime]::MinValue
if(-not (Set-GuardianRestoreMode -Mode $script:restoreMode)){$stateLabel.Text='تم الاختيار؛ تعذر حفظه للمرة القادمة'}
})
$form.Controls.Add($restoreModeChoice)
$modeTip=New-Object System.Windows.Forms.ToolTip
$modeTip.SetToolTip($restoreModeChoice,'عند إغلاق نافذة الرصد: مرصاد ومدرستي يسترجع تبويبات كروم؛ مرصاد فقط يفتح مرصاد دون طلب استرجاعها. اختيارك محفوظ.')
'''
 assert marker in s;s=s.replace(marker,choice+marker,1)
 warning='ستبقى نافذة الرصد مكبّرة وفي المقدمة. يسترجع تبويبات كروم المغلقة عند إغلاق نافذة الرصد ثم يتحقق من وجود مرصاد ويُعرض تيمز الموجود في نافذته.'
 assert warning in s
 s=s.replace(warning, "ستبقى نافذة الرصد مكبّرة وفي المقدمة. يُعرض تيمز الموجود في نافذته.`n$(if($script:restoreMode -eq 'session'){'عند إغلاق النافذة: استرجاع مرصاد ومدرستي من تبويبات كروم.'}else{'عند إغلاق النافذة: فتح مرصاد فقط دون استرجاع التبويبات.'})")
 assert 'Restore-GuardianWorkspace -Windows' in s
 (here/f'{edition}.ps1').write_bytes(b'\xef\xbb\xbf'+s.encode())
 build=Path('/tmp/mirsad-guardian-session-build')/edition;build.mkdir(parents=True,exist_ok=True)
 for name in ['go.mod','launcher.go','launcher_windows.go','launcher_test.go','rsrc_windows_amd64.syso']:
  shutil.copy2(root/'chrome-guardian'/name,build/name)
 (build/'MirsadChromeGuardian.ps1').write_bytes(b'\xef\xbb\xbf'+s.encode())
 print(build)
