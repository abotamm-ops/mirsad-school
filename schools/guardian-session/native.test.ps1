$ErrorActionPreference='Stop'
$s=Get-Content (Join-Path $PSScriptRoot 'Shared.ps1') -Raw -Encoding UTF8
$a=$s.IndexOf("Add-Type @'")+12;$b=$s.IndexOf("'@",$a)
Add-Type -TypeDefinition $s.Substring($a,$b-$a)
if([System.Runtime.InteropServices.Marshal]::SizeOf([type][MirsadChromeWindow+RestoreInput]) -ne 40){throw 'Invalid x64 SendInput layout'}
'PASS native window/restore code compiles and SendInput x64 structure is 40 bytes'
