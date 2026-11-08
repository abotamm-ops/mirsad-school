$ErrorActionPreference='Stop'
Add-Type -TypeDefinition (Get-Content (Join-Path $PSScriptRoot 'tabs341.cs') -Raw)
[TabsTest]::Run()
