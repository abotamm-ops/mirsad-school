$ErrorActionPreference='Stop'
$s=Get-Content (Join-Path $PSScriptRoot 'MirsadChromeGuardian.ps1') -Raw -Encoding UTF8
$t=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$t,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
foreach($name in @('Get-MirsadProducts','Get-MirsadChoices')){
 $node=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
 if(!$node){throw "Missing $name"};Invoke-Expression $node.Extent.Text
}
$dir=Join-Path ([IO.Path]::GetTempPath()) ('mirsad-compat-test-'+[guid]::NewGuid())
try{
 $profile=Join-Path $dir 'Default';[void](New-Item -ItemType Directory -Path $profile -Force)
 $prefs=@{profile=@{name='Test'};extensions=@{settings=@{'mdkhgdcnfibnemhiklpejojajjajhcbg'=@{state=1};'ologpgneejnippbdhboiaaijpgkejcck'=@{state=1}}}}|ConvertTo-Json -Depth 8
 Set-Content -LiteralPath (Join-Path $profile 'Preferences') -Value $prefs -Encoding UTF8
 $choices=@(Get-MirsadChoices -DataDir $dir)
 if($choices.Count -ne 2){throw 'Both editions not detected'}
 if($choices[0].Url -eq $choices[1].Url -or $choices[0].Prefix -eq $choices[1].Prefix){throw 'Editions mixed'}
}finally{if(Test-Path $dir){Remove-Item -LiteralPath $dir -Recurse -Force}}
$start=$s.IndexOf("Add-Type @'")+12;$end=$s.IndexOf("'@",$start);Add-Type -TypeDefinition $s.Substring($start,$end-$start)
if(!$s.Contains('$null=Get-GuardianLaunch') -or !$s.Contains('$launch.Url)')){throw 'Routing failed'}
'PASS working-launcher script parses, both editions isolated, native class compiles'


if(!$s.Contains('$timer.Interval = 500')){throw 'Slow guard'}
if(!$s.Contains('if(IsIconic(hwnd)||!IsZoomed(hwnd))ShowWindowAsync(hwnd,3);')){throw 'Restore and maximize missing'}
if(!$s.Contains('foreground!=panel && foreground!=hwnd')){throw 'Panel not exempt'}
if(!$s.Contains('$pauseButton.PerformClick()')){throw 'Pause shortcut missing'}
if($s.Contains("$form.Hide()")){throw 'Unexpected hidden UI'}
if($s.Contains("if (-not $hotkeys.Register()) { throw")){throw 'Shortcut conflict blocks startup'}
$hot=$s.Substring($s.IndexOf('using System;', $s.IndexOf('Add-Type -ReferencedAssemblies System.Windows.Forms')))
$hot=$hot.Substring(0,$hot.IndexOf("'@"))
$fake='namespace System.Windows.Forms { public struct Message { public int Msg; public System.IntPtr WParam; } public interface IMessageFilter { bool PreFilterMessage(ref Message m); } public static class Application { public static void AddMessageFilter(IMessageFilter f){} public static void RemoveMessageFilter(IMessageFilter f){} } }'
Add-Type -TypeDefinition ($hot+$fake)
'PASS maximize, foreground exception, 500ms guard, visible UI, pause registration and native classes compile'
