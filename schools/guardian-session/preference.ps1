function Get-GuardianRestoreMode([string]$Path=$script:restoreModeFile) {
try{$value=([IO.File]::ReadAllText($Path)).Trim();if($value -in @('session','dashboard')){return $value}}catch{}
return 'session'
}
function Set-GuardianRestoreMode([ValidateSet('session','dashboard')][string]$Mode,[string]$Path=$script:restoreModeFile) {
try{[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path));[IO.File]::WriteAllText($Path,$Mode);return $true}catch{return $false}
}
