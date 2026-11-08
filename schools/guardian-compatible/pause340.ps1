$ErrorActionPreference='Stop'
class MirsadChromeWindow {
 static [int]$Unpinned=0
 static [bool]$Awake=$true
 static [void]Unpin([IntPtr]$h){[MirsadChromeWindow]::Unpinned++}
 static [bool]KeepAwake([bool]$v){[MirsadChromeWindow]::Awake=$v;return $true}
}
$s=Get-Content (Join-Path $PSScriptRoot 'MirsadChromeGuardian.ps1') -Raw -Encoding UTF8
$t=$null;$e=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$t,[ref]$e)
$n=$ast.Find({param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$pauseButton' -and $n.Member.Value -eq 'add_Click'},$true)
$timer=[pscustomobject]@{Enabled=$true};$timer|Add-Member ScriptMethod Stop {$this.Enabled=$false}
$startButton=[pscustomobject]@{Enabled=$false};$stateLabel=[pscustomobject]@{Text=''};$tray=[pscustomobject]@{Text=''}
$script:watched=[IntPtr]42
& ([scriptblock]::Create($n.Arguments[0].ScriptBlock.Extent.Text.Trim('{}')))
if($timer.Enabled -or !$startButton.Enabled -or [MirsadChromeWindow]::Awake -or [MirsadChromeWindow]::Unpinned -ne 1){throw 'Pause failed to release workspace'}
'PASS actual pause handler stops guard, releases window, enables restart, releases sleep prevention'
