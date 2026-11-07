$s=Get-Content (Join-Path $PSScriptRoot 'MirsadChromeGuardian.ps1') -Raw -Encoding UTF8
$start=$s.IndexOf("Add-Type @'")+12
$end=$s.IndexOf("'@",$start)
$code=$s.Substring($start,$end-$start)
Add-Type -TypeDefinition $code
if(-not ('MirsadChromeWindow' -as [type])){throw 'Window class failed to compile'}
'PASS Windows native class compiled; actual window behavior still requires Windows'
