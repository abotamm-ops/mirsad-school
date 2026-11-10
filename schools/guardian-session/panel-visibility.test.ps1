$ErrorActionPreference='Stop'
class MirsadChromeWindow {static [bool]ShowWindowAsync([IntPtr]$h,[int]$mode){return $true}}
. (Join-Path $PSScriptRoot 'panel-visibility.ps1')
$script:exiting=$false;$script:running=$false;$script:panelLocation='bottom-right'
$form=[pscustomobject]@{Handle=[IntPtr]42;IsDisposed=$false;ShowInTaskbar=$false;WindowState='Minimized';Location='off-screen';TopMost=$false;Shown=0;Brought=0;Activated=0}
$form|Add-Member ScriptMethod Show {$this.Shown++}
$form|Add-Member ScriptMethod BringToFront {$this.Brought++}
$form|Add-Member ScriptMethod Activate {$this.Activated++}
Show-GuardianPanel
if($form.WindowState -ne 'Normal' -or !$form.ShowInTaskbar -or !$form.TopMost -or $form.Location -ne 'bottom-right' -or $form.Shown -ne 1 -or $form.Activated -ne 1){throw 'Show panel did not restore its visible taskbar window'}
if($script:running){throw 'Showing panel unexpectedly starts browser protection'}
$script:exiting=$true;Show-GuardianPanel
if($form.Shown -ne 1){throw 'Closing panel was reopened'}
foreach($edition in @('Shared','Schools')){
$s=Get-Content (Join-Path $PSScriptRoot "$edition.ps1") -Raw -Encoding UTF8
$t=$null;$e=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$t,[ref]$e)
if($e.Count){throw ($e|Out-String)}
$shown=$ast.Find({param($n)$n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$form' -and $n.Member.Value -eq 'add_Shown'},$true)
if($shown.Extent.Text.Contains('$startButton.PerformClick()')){throw 'Startup modal still precedes panel selection'}
if(!$shown.Extent.Text.Contains('Show-GuardianPanel')){throw 'Startup does not explicitly reveal panel'}
if(!$s.Contains('[void]$showSignal.Set()') -or !$s.Contains('if($showSignal.WaitOne(0)){Show-GuardianPanel}')){throw 'Second launch does not signal the original panel'}
if(!$s.Contains('$panelTimer.Stop()') -or !$s.Contains('$showSignal.Dispose()')){throw 'Panel event/timer survive exit'}
"PASS $edition visible startup before Start, second-launch reveal, close cleanup"
}
'PASS actual Show-GuardianPanel restores minimized/off-screen panel without starting guard, and ignores exit state'
