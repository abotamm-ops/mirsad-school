$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '../chrome-guardian/MirsadChromeGuardian.ps1'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $path), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
# Compile the real Windows interop declarations without calling Windows APIs on Linux.
$csharp = $ast.FindAll({param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $n.Value.Contains('public static class MirsadChromeWindow')}, $true)[0].Value
Add-Type -TypeDefinition ($csharp.Replace('MirsadChromeWindow', 'MirsadChromeWindowCompileCheck'))
# Run the real timer callback against a native-window test double.
Add-Type @'
using System;
public static class MirsadChromeWindow {
 public static IntPtr[] Items = new IntPtr[0];
 public static bool Awake;
 public static bool Minimized;
 public static bool Maximized = true;
 public static IntPtr LastRestored;
 public static bool KeepAwake(bool enabled) { Awake=enabled; return true; }
 public static IntPtr[] Windows() { return Items; }
 public static bool IsMirsad(IntPtr h) { return h.ToInt64()==100 || h.ToInt64()==200; }
 public static bool IsIconic(IntPtr h) { return Minimized; }
 public static bool IsZoomed(IntPtr h) { return Maximized; }
 public static bool ShowWindowAsync(IntPtr h, int mode) { LastRestored=h; return true; }
}
'@
$tickNode = $ast.FindAll({param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Member.Value -eq 'add_Tick'}, $true)[0]
$tick = $tickNode.Arguments[0].ScriptBlock.GetScriptBlock()
$script:watched = [IntPtr]::Zero; $script:before=@(); $script:pending=$false; $script:deadline=[DateTime]::MinValue
$script:guardianChrome='C:\Chrome\chrome.exe'; $script:guardianProfile='Profile 2'; $script:launches=@()
function Start-Process {param($FilePath,$ArgumentList) $script:launches += ,@($FilePath, $ArgumentList)}
function Check($ok,$message) { if (-not $ok) {throw $message} }
& $tick
Check ([MirsadChromeWindow]::Awake) 'Did not request screen/system awake'
Check ($script:launches.Count -eq 1 -and $script:pending) 'Missing initial browser launch'
Check ($script:launches[0][1][0] -eq '--profile-directory="Profile 2"') 'Lost selected profile or argument quoting'
Check ($script:launches[0][1][-1] -eq 'https://mirsad-school.onrender.com/automatic-monitoring.html') 'Unexpected destination'
& $tick
Check ($script:launches.Count -eq 1) 'Launched duplicate while waiting'
[MirsadChromeWindow]::Items=@([IntPtr]99)
& $tick
Check ($script:watched -eq [IntPtr]::Zero) 'Attached to unrelated Chrome window'
[MirsadChromeWindow]::Items=@([IntPtr]99,[IntPtr]100)
& $tick
Check ($script:watched -eq [IntPtr]100 -and -not $script:pending) 'Did not find newly opened Mirsad window'
[MirsadChromeWindow]::Minimized=$true
& $tick
Check ([MirsadChromeWindow]::LastRestored -eq [IntPtr]100) 'Did not maximize minimized Mirsad window'
Check ($script:launches.Count -eq 1) 'Opened duplicate for minimized window'
[MirsadChromeWindow]::Items=@([IntPtr]99)
& $tick
Check ($script:launches.Count -eq 2 -and $script:pending) 'Did not reopen after the watched window was closed while other Chrome windows remained'
[MirsadChromeWindow]::Items=@([IntPtr]99,[IntPtr]200)
& $tick
Check ($script:watched -eq [IntPtr]200) 'Did not attach to reopened window'
Write-Output 'PASS PowerShell syntax, Windows interop compilation and real watchdog callback with simulated window discovery, profile quoting, minimizing, closure and bounded relaunch'
