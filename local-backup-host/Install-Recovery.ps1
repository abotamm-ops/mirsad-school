$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:LOCALAPPDATA 'Mirsad\LocalBackup'
$extensionId = 'mdkhgdcnfibnemhiklpejojajjajhcbg'
$chrome = @(
    (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
    (Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $chrome) { throw 'Google Chrome was not found.' }
$dataDir = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
$candidates = @()
foreach ($folder in (Get-ChildItem -LiteralPath $dataDir -Directory | Where-Object { $_.Name -eq 'Default' -or $_.Name -match '^Profile [0-9]+$' })) {
    foreach ($name in @('Preferences','Secure Preferences')) {
        $file = Join-Path $folder.FullName $name
        if (-not (Test-Path -LiteralPath $file)) { continue }
        try {
            $settings = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($settings.extensions.settings.PSObject.Properties.Name -contains $extensionId) { $candidates += $folder.Name; break }
        } catch { }
    }
}
$candidates = @($candidates | Sort-Object -Unique)
if ($candidates.Count -eq 0) { throw 'School extension not found in Chrome. Keep Chrome open with the school extension, then run Install.cmd again.' }
$profile = $candidates[0]
if ($candidates.Count -gt 1) {
    Write-Host 'The school extension exists in more than one Chrome profile. Choose its monitoring profile:'
    for ($i=0; $i -lt $candidates.Count; $i++) { Write-Host ("{0}: {1}" -f ($i+1),$candidates[$i]) }
    $choice = 0
    if (-not [int]::TryParse((Read-Host 'Profile number'), [ref]$choice) -or $choice -lt 1 -or $choice -gt $candidates.Count) { throw 'Invalid profile selection.' }
    $profile = $candidates[$choice-1]
}
$config = @{chromePath=$chrome;profile=$profile;extensionId=$extensionId}
[IO.File]::WriteAllText((Join-Path $installDir 'browser-recovery.json'),($config | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
[IO.File]::WriteAllText((Join-Path $installDir 'browser-state.json'),'{}',(New-Object Text.UTF8Encoding $false))
$exe = Join-Path $installDir 'MirsadBackupHost.exe'
$startup = [Environment]::GetFolderPath('Startup')
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path $startup 'Mirsad School Browser Recovery.lnk'))
$link.TargetPath=$exe
$link.Arguments='--browser-recovery'
$link.WorkingDirectory=$installDir
$link.WindowStyle=7
$link.Description='Reopen school Chrome after a minute only while monitoring is active'
$link.Save()
Start-Process -FilePath $exe -ArgumentList '--browser-recovery' -WindowStyle Hidden
Write-Host ('Browser recovery ready for Chrome profile: '+$profile) -ForegroundColor Green
