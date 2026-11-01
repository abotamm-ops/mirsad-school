$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'Mirsad\LocalBackup'
$exe = Join-Path $dir 'MirsadBackupHost.exe'
Get-CimInstance Win32_Process -Filter "Name = 'MirsadBackupHost.exe'" | Where-Object { $_.ExecutablePath -eq $exe -and $_.CommandLine -like '*--browser-recovery*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
if (Test-Path -LiteralPath $dir) {
    $state = @{running=$false;at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}
    [IO.File]::WriteAllText((Join-Path $dir 'browser-state.json'),($state | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
}
$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Mirsad School Browser Recovery.lnk'
if (Test-Path -LiteralPath $link) { Remove-Item -LiteralPath $link -Force }
Write-Host 'Automatic Chrome reopening is disabled. Your backups and evidence are unchanged.' -ForegroundColor Green
