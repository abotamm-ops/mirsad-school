param([string]$ExtensionId)
$ErrorActionPreference = 'Stop'
if (-not $ExtensionId) { $ExtensionId = Read-Host 'Paste the Mirsad extension ID from chrome://extensions' }
$ExtensionId = $ExtensionId.Trim()
if ($ExtensionId -notmatch '^[a-p]{32}$') { throw 'Invalid extension ID. Copy its 32 lowercase letters from chrome://extensions.' }
$installDir = Join-Path $env:LOCALAPPDATA 'Mirsad\LocalBackup'
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$exe = Join-Path $installDir 'MirsadBackupHost.exe'
$arch = if ([Environment]::Is64BitOperatingSystem) { 'amd64' } else { '386' }
$sourceExe = Join-Path $PSScriptRoot "MirsadBackupHost-$arch.exe"
if (-not (Test-Path -LiteralPath $sourceExe)) { throw "Missing backup executable: $sourceExe" }
Copy-Item -LiteralPath $sourceExe -Destination $exe -Force
$manifest = @{
    name = 'com.mirsad.local_backup'
    description = 'Mirsad verified backups to G and K with C fallback'
    path = $exe
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestPath = Join-Path $installDir 'com.mirsad.local_backup.json'
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false))
foreach ($browser in @('Google\Chrome','Microsoft\Edge')) {
    $registry = "HKCU:\Software\$browser\NativeMessagingHosts\com.mirsad.local_backup"
    New-Item -Path $registry -Force | Out-Null
    Set-Item -Path $registry -Value $manifestPath
}
Write-Host 'Installed for this Windows user. No administrator permission required.' -ForegroundColor Green
Write-Host 'Reload the Mirsad extension, open Drive, then click the local backup check button.'
Write-Host 'Backups: G:\Data Copy AND K:\Data Copy. C:\Data Copy replaces an unavailable primary drive.'
