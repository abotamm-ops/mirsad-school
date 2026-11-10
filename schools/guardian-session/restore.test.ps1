$ErrorActionPreference='Stop'
class MirsadChromeWindow {
static [int]$Focused=0
static [int]$Restored=0
static [bool]$Allowed=$true
static [void]FocusForOpen([IntPtr]$h){[MirsadChromeWindow]::Focused++}
static [bool]RestoreTabs([IntPtr]$h){if(![MirsadChromeWindow]::Allowed){return $false};[MirsadChromeWindow]::Restored++;return $true}
}
function Start-Process {param($FilePath,$ArgumentList)$script:launches++;$script:argsUsed=$ArgumentList}
function Reset-Restore {
$script:restoreMode='session';$script:launches=0;$script:hadWorkspace=$true;$script:restoreTried=$false;$script:restoreUntil=[DateTime]::MinValue;$script:restoreTarget=[IntPtr]::Zero;$script:watched=[IntPtr]42
[MirsadChromeWindow]::Focused=0;[MirsadChromeWindow]::Restored=0;[MirsadChromeWindow]::Allowed=$true
}
. (Join-Path $PSScriptRoot 'restore.ps1')
$now=[DateTime]'2026-11-10T09:00:00Z';$launch=@{Chrome='chrome.exe';Profile='Profile 2'}
Reset-Restore
if(!(Restore-GuardianWorkspace @() @() $launch $now)){throw 'Closed browser was not restored'}
if($script:launches -ne 1 -or $script:argsUsed -notcontains '--restore-last-session' -or $script:argsUsed -notcontains '--profile-directory="Profile 2"'){throw 'Wrong profile/session launch'}
if(!(Restore-GuardianWorkspace @() @() $launch $now.AddSeconds(1)) -or $script:launches -ne 1){throw 'Restore launches duplicates'}
if(Restore-GuardianWorkspace @() @() $launch $now.AddSeconds(16)){throw 'Fallback never becomes available'}
'PASS closed browser session: selected profile, no URL launch, one attempt, bounded fallback'
Reset-Restore
$windows=@([IntPtr]42);$inventory=@([pscustomobject]@{Handle=42;Madrasati=$true})
if(!(Restore-GuardianWorkspace $windows $inventory $launch $now)){throw 'Focus phase missing'}
if([MirsadChromeWindow]::Restored -ne 0){throw 'Shortcut sent before focus phase'}
if(!(Restore-GuardianWorkspace $windows $inventory $launch $now.AddSeconds(1))){throw 'Restore key phase missing'}
$null=Restore-GuardianWorkspace $windows $inventory $launch $now.AddSeconds(2)
if([MirsadChromeWindow]::Restored -ne 1 -or $script:launches -ne 0){throw 'Repeated shortcut or unexpected launch'}
'PASS closed tab/window: focus first, one restore shortcut, wait for inventory before fallback'
Reset-Restore
$script:hadWorkspace=$false
if(Restore-GuardianWorkspace $windows $inventory $launch $now){throw 'Fresh startup restored unrelated tabs'}
if([MirsadChromeWindow]::Restored -ne 0){throw 'Fresh startup sent restore shortcut'}
'PASS existing Chrome first launch does not restore unrelated tabs'
Reset-Restore
[MirsadChromeWindow]::Allowed=$false
$null=Restore-GuardianWorkspace $windows $inventory $launch $now
if(Restore-GuardianWorkspace $windows $inventory $launch $now.AddSeconds(4)){throw 'Focus timeout did not allow fallback'}
if([MirsadChromeWindow]::Restored -ne 0){throw 'Shortcut delivered without confirmed foreground'}
'PASS unavailable foreground: no shortcut, bounded fallback'
foreach($edition in @('Shared','Schools')){
$s=Get-Content (Join-Path $PSScriptRoot "$edition.ps1") -Raw -Encoding UTF8
$t=$null;$e=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$t,[ref]$e)
if($e.Count){throw ($e|Out-String)}
$node=$ast.Find({param($n)$n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$timer' -and $n.Member.Value -eq 'add_Tick'},$true)
$body=$node.Arguments[0].Extent.Text
if($body.IndexOf('if ($fresh -and $target)') -gt $body.IndexOf('if(Restore-GuardianWorkspace')){throw 'Restore precedes existing dashboard detection'}
if($body.IndexOf('if(Restore-GuardianWorkspace') -gt $body.IndexOf('Start-Process -FilePath $launch.Chrome')){throw 'URL opened before restore attempt'}
"PASS $edition actual tick checks existing dashboard before restore, then falls back to open URL"
}

Reset-Restore
$script:restoreMode='dashboard'
if(Restore-GuardianWorkspace @() @() $launch $now){throw 'Dashboard-only mode restored a closed session'}
if(Restore-GuardianWorkspace $windows $inventory $launch $now){throw 'Dashboard-only mode restored a closed tab'}
if($script:launches -ne 0 -or [MirsadChromeWindow]::Restored -ne 0){throw 'Dashboard-only mode sent a restore action'}
'PASS dashboard-only mode never invokes session or keyboard restoration'
