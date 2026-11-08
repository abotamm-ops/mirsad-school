$ErrorActionPreference='Stop'
Add-Type -TypeDefinition (Get-Content (Join-Path $PSScriptRoot 'guard340.cs') -Raw)
[GuardTest]::Run()
