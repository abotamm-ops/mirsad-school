function Restore-GuardianWorkspace($Windows,$Inventory,$Launch,[DateTime]$Now=[DateTime]::UtcNow) {
if($script:restoreTried){return $Now -lt $script:restoreUntil}
if($Windows.Count -eq 0){
$script:restoreTried=$true;$script:restoreUntil=$Now.AddSeconds(15)
Start-Process -FilePath $Launch.Chrome -ArgumentList @(('--profile-directory="'+$Launch.Profile+'"'),'--restore-last-session')|Out-Null
return $true
}
if(-not $script:hadWorkspace){$script:restoreTried=$true;return $false}
if($script:restoreTarget -eq [IntPtr]::Zero){
if($Windows -contains $script:watched){$script:restoreTarget=$script:watched}
else{$source=$Inventory|Where-Object {$_.Madrasati}|Select-Object -First 1;if(-not $source){$source=$Inventory|Select-Object -First 1};if($source){$script:restoreTarget=[IntPtr]$source.Handle}}
if($script:restoreTarget -eq [IntPtr]::Zero){$script:restoreTried=$true;return $false}
$script:restoreUntil=$Now.AddSeconds(3)
[MirsadChromeWindow]::FocusForOpen($script:restoreTarget)
return $true
}
if([MirsadChromeWindow]::RestoreTabs($script:restoreTarget)){
$script:restoreTried=$true;$script:restoreTarget=[IntPtr]::Zero;$script:restoreUntil=$Now.AddSeconds(15)
return $true
}
if($Now -lt $script:restoreUntil){[MirsadChromeWindow]::FocusForOpen($script:restoreTarget);return $true}
$script:restoreTried=$true;$script:restoreTarget=[IntPtr]::Zero
return $false
}
