$ErrorActionPreference='Stop'
Add-Type @'
namespace System.Windows.Forms {
public enum MessageBoxButtons {YesNo}
public enum MessageBoxIcon {Information}
public enum MessageBoxDefaultButton {Button2}
public enum DialogResult {No,Yes}
public static class MessageBox {
public static DialogResult Answer=DialogResult.No;public static int Calls;
public static DialogResult Show(object form,string text,string title,MessageBoxButtons buttons,MessageBoxIcon icon,MessageBoxDefaultButton defaultButton){Calls++;if(defaultButton!=MessageBoxDefaultButton.Button2||!text.Contains("Ctrl + Shift + Q"))throw new System.Exception("Unsafe consent");return Answer;}
}}
'@
$s=Get-Content (Join-Path $PSScriptRoot 'MirsadChromeGuardian.ps1') -Raw -Encoding UTF8
$t=$null;$e=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$t,[ref]$e)
$n=$ast.Find({param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$startButton' -and $n.Member.Value -eq 'add_Click'},$true)
$body=[scriptblock]::Create($n.Arguments[0].ScriptBlock.Extent.Text.Trim('{}'))
$form=[pscustomobject]@{};$timer=[pscustomobject]@{Enabled=$false};$timer|Add-Member ScriptMethod Start {$this.Enabled=$true}
$startButton=[pscustomobject]@{Enabled=$true};$stateLabel=[pscustomobject]@{Text='';ForeColor=$null};$tray=[pscustomobject]@{Text=''}
$script:Lookups=0;function Get-GuardianLaunch {$script:Lookups++;return @{}}
& $body
if($timer.Enabled -or $script:Lookups){throw 'Decline still starts guard or profile picker'}
[System.Windows.Forms.MessageBox]::Answer='Yes'
& $body
if(!$timer.Enabled -or $script:Lookups -ne 1){throw 'Approval did not start'}
& $body
if([System.Windows.Forms.MessageBox]::Calls -ne 2){throw 'Already-running guard repeats consent'}
'PASS real start handler: default No, decline has no effects, consent precedes chooser, approval starts once'
