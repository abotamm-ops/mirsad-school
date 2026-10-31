$ErrorActionPreference = 'Stop'
foreach ($browser in @('Google\Chrome','Microsoft\Edge')) {
    $registry = "HKCU:\Software\$browser\NativeMessagingHosts\com.mirsad.local_backup"
    if (Test-Path $registry) { Remove-Item -Path $registry -Recurse -Force }
}
$installDir = Join-Path $env:LOCALAPPDATA 'Mirsad\LocalBackup'
$exe = Join-Path $installDir 'MirsadBackupHost.exe'
Get-CimInstance Win32_Process -Filter "Name = 'MirsadBackupHost.exe'" | Where-Object { $_.ExecutablePath -eq $exe -and $_.CommandLine -like '*--browser-recovery*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Mirsad School Browser Recovery.lnk'
if (Test-Path -LiteralPath $link) { Remove-Item -LiteralPath $link -Force }

if (Test-Path -LiteralPath $installDir) { Remove-Item -LiteralPath $installDir -Recurse -Force }
Write-Host 'Helper removed. Your Data Copy folders and evidence were not deleted.'
