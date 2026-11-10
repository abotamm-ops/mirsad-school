$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'preference.ps1')
$folder=Join-Path ([IO.Path]::GetTempPath()) ('mirsad-mode-'+[guid]::NewGuid().ToString('N'))
try{
$script:restoreModeFile=Join-Path $folder 'mode.txt'
if((Get-GuardianRestoreMode) -ne 'session'){throw 'Default mode changed'}
if(!(Set-GuardianRestoreMode dashboard) -or (Get-GuardianRestoreMode) -ne 'dashboard'){throw 'Dashboard-only mode not persisted'}
if(!(Set-GuardianRestoreMode session) -or (Get-GuardianRestoreMode) -ne 'session'){throw 'Session mode not persisted'}
[IO.File]::WriteAllText($script:restoreModeFile,'invalid')
if((Get-GuardianRestoreMode) -ne 'session'){throw 'Corrupt setting was not handled'}
foreach($edition in @('Shared','Schools')){
$s=Get-Content (Join-Path $PSScriptRoot "$edition.ps1") -Raw -Encoding UTF8
$t=$null;$e=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$t,[ref]$e)
if($e.Count){throw ($e|Out-String)}
$handler=$ast.Find({param($n)$n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$restoreModeChoice' -and $n.Member.Value -eq 'add_SelectedIndexChanged'},$true)
if(!$handler){throw 'Mode selector missing'}
$restoreModeChoice=[pscustomobject]@{SelectedIndex=1};$stateLabel=[pscustomobject]@{Text=''}
$script:restoreTried=$true;$script:restoreTarget=[IntPtr]42;$script:restoreUntil=[DateTime]::MaxValue
& $handler.Arguments[0].ScriptBlock.GetScriptBlock()
if($script:restoreMode -ne 'dashboard' -or (Get-GuardianRestoreMode) -ne 'dashboard' -or $script:restoreTried -or $script:restoreTarget -ne [IntPtr]::Zero){throw 'Mode handler failed to switch/reset/persist'}
$restoreModeChoice.SelectedIndex=0
& $handler.Arguments[0].ScriptBlock.GetScriptBlock()
if($script:restoreMode -ne 'session' -or (Get-GuardianRestoreMode) -ne 'session'){throw 'Mode handler failed to switch back'}
"PASS $edition actual selector changes restoration behavior, resets pending attempt and saves choice"
}
'PASS preference defaults, both values, corrupt-file recovery'
}finally{if(Test-Path $folder){Remove-Item -LiteralPath $folder -Recurse -Force}}
