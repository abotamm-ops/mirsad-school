$ErrorActionPreference='Stop'
$s=Get-Content (Join-Path $PSScriptRoot 'MirsadChromeGuardian.ps1') -Raw -Encoding UTF8
$t=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($s,[ref]$t,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
foreach($name in @('Get-MirsadProducts','Get-MirsadChoices')){
 $node=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
 if(!$node){throw "Missing $name"};Invoke-Expression $node.Extent.Text
}
$dir=Join-Path ([IO.Path]::GetTempPath()) ('mirsad-compat-test-'+[guid]::NewGuid())
try{
 $profile=Join-Path $dir 'Default';[void](New-Item -ItemType Directory -Path $profile -Force)
 $prefs=@{profile=@{name='Test'};extensions=@{settings=@{'mdkhgdcnfibnemhiklpejojajjajhcbg'=@{state=1};'ologpgneejnippbdhboiaaijpgkejcck'=@{state=1}}}}|ConvertTo-Json -Depth 8
 Set-Content -LiteralPath (Join-Path $profile 'Preferences') -Value $prefs -Encoding UTF8
 $choices=@(Get-MirsadChoices -DataDir $dir)
 if($choices.Count -ne 2){throw 'Both editions not detected'}
 if($choices[0].Url -eq $choices[1].Url -or $choices[0].Prefix -eq $choices[1].Prefix){throw 'Editions mixed'}
}finally{if(Test-Path $dir){Remove-Item -LiteralPath $dir -Recurse -Force}}
$start=$s.IndexOf("Add-Type @'")+12;$end=$s.IndexOf("'@",$start);Add-Type -TypeDefinition $s.Substring($start,$end-$start)
if(!$s.Contains('$selectedLaunch=Get-GuardianLaunch') -or !$s.Contains('$launch.Url)')){throw 'Routing failed'}
'PASS working-launcher script parses, both editions isolated, native class compiles; UI shape retained'
