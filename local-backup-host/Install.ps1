param([string]$ExtensionId)
$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'Mirsad\LocalBackup'
$manifestPath = Join-Path $installDir 'com.mirsad.local_backup.json'
$ids = New-Object 'System.Collections.Generic.HashSet[string]'
if ($ExtensionId) {
    $ExtensionId = $ExtensionId.Trim()
    if ($ExtensionId -notmatch '^[a-p]{32}$') { throw 'Invalid extension ID.' }
    [void]$ids.Add($ExtensionId)
} else {
    # Inspect extension manifests only; never modify browser profile files.
    $prefix = -join ([char[]]@(0x645,0x631,0x635,0x627,0x62F))
    foreach ($browserPath in @('Google\Chrome\User Data','Microsoft\Edge\User Data')) {
        $dataDir = Join-Path $env:LOCALAPPDATA $browserPath
        if (-not (Test-Path -LiteralPath $dataDir)) { continue }
        foreach ($profile in (Get-ChildItem -LiteralPath $dataDir -Directory | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' })) {
            foreach ($fileName in @('Preferences','Secure Preferences')) {
                $profileFile = Join-Path $profile.FullName $fileName
                if (-not (Test-Path -LiteralPath $profileFile)) { continue }
                try {
                    $settings = (Get-Content -LiteralPath $profileFile -Raw -Encoding UTF8 | ConvertFrom-Json).extensions.settings
                    foreach ($entry in $settings.PSObject.Properties) {
                        $id = $entry.Name
                        if ($id -notmatch '^[a-p]{32}$') { continue }
                        $manifest = $entry.Value.manifest
                        if ($entry.Value.path) {
                            $sourceManifest = Join-Path $entry.Value.path 'manifest.json'
                            if (Test-Path -LiteralPath $sourceManifest) { $manifest = Get-Content -LiteralPath $sourceManifest -Raw -Encoding UTF8 | ConvertFrom-Json }
                        }
                        if ($manifest -and ([string]$manifest.name).StartsWith($prefix) -and ([string]$manifest.name).Contains('Teams') -and ($manifest.permissions -contains 'nativeMessaging')) { [void]$ids.Add($id) }
                    }
                } catch { Write-Host "Could not inspect extension list in $profileFile; trying the next profile." }
            }
        }
    }
}
# Retain existing explicitly registered extension IDs when reinstalling.
if (Test-Path -LiteralPath $manifestPath) {
    try {
        $existing = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($origin in $existing.allowed_origins) { if ($origin -match '^chrome-extension://([a-p]{32})/$') { [void]$ids.Add($Matches[1]) } }
    } catch {}
}
if ($ids.Count -eq 0) {
    $manualId = (Read-Host 'No Mirsad extension detected. Paste its ID from chrome://extensions').Trim()
    if ($manualId -notmatch '^[a-p]{32}$') { throw 'Invalid extension ID. Load/reload the Mirsad extension and run Install.cmd again.' }
    [void]$ids.Add($manualId)
}
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
    allowed_origins = @($ids | Sort-Object | ForEach-Object { "chrome-extension://$_/" })
}
$manifestPath = Join-Path $installDir 'com.mirsad.local_backup.json'
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false))
foreach ($browser in @('Google\Chrome','Microsoft\Edge')) {
    $registry = "HKCU:\Software\$browser\NativeMessagingHosts\com.mirsad.local_backup"
    New-Item -Path $registry -Force | Out-Null
    Set-Item -Path $registry -Value $manifestPath
}
Write-Host ('Registered extension IDs: ' + (($ids | Sort-Object) -join ', '))
Write-Host 'Installed for this Windows user. No administrator permission required.' -ForegroundColor Green
Write-Host 'Reload the Mirsad extension, open Drive, then click the local backup check button.'
Write-Host 'Backups: G:\Data Copy AND K:\Data Copy. C:\Data Copy replaces an unavailable primary drive.'
