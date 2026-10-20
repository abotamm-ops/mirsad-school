$ErrorActionPreference = 'Stop'
foreach ($browser in @('Google\Chrome','Microsoft\Edge')) {
    $registry = "HKCU:\Software\$browser\NativeMessagingHosts\com.mirsad.local_backup"
    if (Test-Path $registry) { Remove-Item -Path $registry -Recurse -Force }
}
$installDir = Join-Path $env:LOCALAPPDATA 'Mirsad\LocalBackup'
if (Test-Path -LiteralPath $installDir) { Remove-Item -LiteralPath $installDir -Recurse -Force }
Write-Host 'Helper removed. Your Data Copy folders and evidence were not deleted.'
