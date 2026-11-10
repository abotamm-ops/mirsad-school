$ErrorActionPreference='Stop'
class MirsadChromeWindow {
 static [int]$Unpinned=0
 static [bool]$Awake=$true
 static [void]Unpin([IntPtr]$h){[MirsadChromeWindow]::Unpinned++}
 static [bool]KeepAwake([bool]$v){[MirsadChromeWindow]::Awake=$v;return $true}
}
class MirsadChromeTabs {static [long]$GuardHandle=42}
foreach($edition in @('Shared','Schools')){
 $s=Get-Content (Join-Path $PSScriptRoot "$edition.ps1") -Raw -Encoding UTF8
 $tokens=$null;$errors=$null
 $ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$tokens,[ref]$errors)
 if($errors.Count){throw ($errors|Out-String)}
 $stop=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Stop-Guardian'},$true)
 Invoke-Expression $stop.Extent.Text
 $timer=[pscustomobject]@{Enabled=$true};$timer|Add-Member ScriptMethod Stop {$this.Enabled=$false}
 $startButton=[pscustomobject]@{Enabled=$false};$stateLabel=[pscustomobject]@{Text=''}
 $tray=[pscustomobject]@{Text='';Visible=$true}
 $script:running=$true;$script:exiting=$false;$script:pending=$true;$script:watched=[IntPtr]42
 [MirsadChromeTabs]::GuardHandle=42
 [MirsadChromeWindow]::Awake=$true
 $pause=$ast.Find({param($n)$n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$pauseButton' -and $n.Member.Value -eq 'add_Click'},$true)
 & $pause.Arguments[0].ScriptBlock.GetScriptBlock()
 if($script:running -or $timer.Enabled -or $script:pending -or [MirsadChromeTabs]::GuardHandle -ne 0 -or [MirsadChromeWindow]::Awake -or !$startButton.Enabled){throw 'Pause did not release guard'}
 $script:running=$true;$timer.Enabled=$true
 $closing=$ast.Find({param($n)$n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$form' -and $n.Member.Value -eq 'add_FormClosing'},$true)
 & $closing.Arguments[0].ScriptBlock.GetScriptBlock()
 if(!$script:exiting -or $script:running -or $timer.Enabled -or $tray.Visible){throw 'Close left guard or tray active'}
 if($s.Contains('AttachThreadInput(')){throw 'Blocking browser thread attachment remains'}
 if(!$s.Contains('$form.MinimizeBox=$true') -or $s.Contains('$form.Hide()')){throw 'Taskbar minimize behavior changed'}
 if(!$s.Contains('$timer.Interval = 500') -or !$s.Contains('::KeepWorkspace(')){throw 'Foreground guard missing'}
 if(!$s.Contains('$hotkeys.add_ExitRequested({$form.Close()})')){throw 'Exit shortcut bypasses cleanup'}
 Write-Output "$edition PASS: parse, actual pause/close handlers, foreground guard, minimize, exit shortcut"
}
