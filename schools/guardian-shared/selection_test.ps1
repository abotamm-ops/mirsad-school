$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Guardian-Selection.ps1')
function Assert($value,$message){if(-not $value){throw $message}}
$root=Join-Path ([System.IO.Path]::GetTempPath()) ('mirsad-selection-test-'+[guid]::NewGuid())
try {
    [void](New-Item -ItemType Directory -Path (Join-Path $root 'Default'))
    $private='mdkhgdcnfibnemhiklpejojajjajhcbg';$schools='ologpgneejnippbdhboiaaijpgkejcck'
    $prefs=Join-Path $root 'Default/Preferences'
    @{profile=@{name='اختبار'};extensions=@{settings=@{$private=@{state=1};$schools=@{state=1}}}} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $prefs -Encoding UTF8
    $before=(Get-FileHash $prefs).Hash
    $choices=@(Get-MirsadChoices -DataDir $root)
    Assert ($choices.Count -eq 2) 'Both editions in one Chrome profile must remain distinct choices'
    Assert ($choices[0].Edition -eq 'Private' -and $choices[1].Edition -eq 'Schools') 'Wrong edition mapping'
    Assert ($choices[0].Url -eq 'https://mirsad-school.onrender.com/automatic-monitoring.html?guardian=1') 'Private URL changed'
    Assert ($choices[1].Url -eq 'https://mirsad-school.onrender.com/schools/automatic-monitoring.html?guardian=1') 'School URL changed'
    $one=@(Get-MirsadChoices -DataDir $root -Edition Schools)
    Assert ($one.Count -eq 1 -and (Select-MirsadChoice $one).ExtensionId -eq $schools) 'Single school install must auto-select without prompting'
    @{extensions=@{settings=@{$schools=@{state=0}}}} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root 'Default/Secure Preferences') -Encoding UTF8
    $choices=@(Get-MirsadChoices -DataDir $root)
    Assert ($choices.Count -eq 1 -and $choices[0].Edition -eq 'Private') 'Disabled secure-preference extension must not be selected'
    Assert ((@(Get-MirsadChoices -DataDir $root -Profile 'Profile 3')).Count -eq 0) 'Do not fall back to a different profile'
    [void](New-Item -ItemType Directory -Path (Join-Path $root 'Profile 3'))
    Copy-Item $prefs (Join-Path $root 'Profile 3/Preferences')
    Assert ((@(Get-MirsadChoices -DataDir $root -Edition Schools)).Count -eq 1) 'Multiple profiles must be filtered by edition'
    Assert ((Get-FileHash $prefs).Hash -eq $before) 'Helper modified Chrome preferences'
    $main=Get-Content (Join-Path $PSScriptRoot 'MirsadChromeGuardian.ps1') -Raw -Encoding UTF8
    $tokens=$null;$errors=$null
    [void][System.Management.Automation.Language.Parser]::ParseInput($main,[ref]$tokens,[ref]$errors)
    Assert ($errors.Count -eq 0) ('PowerShell parse errors: '+($errors|Out-String))
    $timer=$main.Substring($main.IndexOf('$timer.add_Tick'),$main.IndexOf('$startButton.add_Click')-$main.IndexOf('$timer.add_Tick'))
    Assert (-not $timer.Contains('ShowWindowAsync')) 'Timer must respect minimization'
    Assert ($timer.Contains('$launch.Url')) 'Launch must use the selected edition URL'
    Assert (-not $timer.Contains('$inventory[0]')) 'Must not focus an arbitrary other Chrome window'
    Assert ($main.Contains('Local\MirsadUnifiedGuardian') -and $main.Contains('Local\MirsadSchoolsGuardian')) 'Missing old-helper conflict protection'
    $titleBody=[regex]::Match($main,'public static bool DashboardTitle\(string name\) \{[^}]+\}').Value
    Add-Type ('using System; public static class TitleMatchTest {public static string TitlePrefix="";'+$titleBody+'}')
    [TitleMatchTest]::TitlePrefix='مرصاد المدارس | الرصد الآلي'
    Assert ([TitleMatchTest]::DashboardTitle('مرصاد المدارس | الرصد الآلي - Google Chrome')) 'School title not recognized'
    Assert (-not [TitleMatchTest]::DashboardTitle('مرصاد | الرصد الآلي - Google Chrome')) 'School helper attached to private dashboard'
    [TitleMatchTest]::TitlePrefix='مرصاد | الرصد الآلي'
    Assert ([TitleMatchTest]::DashboardTitle('مرصاد | الرصد الآلي - Google Chrome')) 'Private title not recognized'
    Assert (-not [TitleMatchTest]::DashboardTitle('مرصاد المدارس | الرصد الآلي - Google Chrome')) 'Private helper attached to school dashboard'
    Write-Output 'PASS: profiles and editions, disabled extension, read-only preferences, PowerShell parser, title isolation, minimized-window policy, legacy-helper conflict'
} finally {if(Test-Path $root){Remove-Item -LiteralPath $root -Recurse -Force}}
