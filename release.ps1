#requires -Version 5.1
<#
.SYNOPSIS
    Bump 1547core module version and produce 1547core.zip at the repo root.

.DESCRIPTION
    - Reads modules/1547core/module.json
    - Bumps the version field (patch by default; semver part name accepted)
    - Writes module.json back
    - Zips modules/1547core into 1547core.zip at the repo root, with
      "1547core/" as the zip's top-level folder (matching the existing
      release layout). Includes everything under the module dir.
    - Commits both files with "release: 1547core <version>" and pushes
      the current branch. Other working-tree changes are left untouched.
    - Use -SkipPush to commit but defer push, or -NoGit to skip git
      entirely (build-only).

.PARAMETER Bump
    Which semver part to increment. One of: patch (default), minor, major.

.PARAMETER SkipPush
    Stage and commit the release files but do not push.

.PARAMETER NoGit
    Skip git entirely; only bump and build the zip.

.EXAMPLE
    ./release.ps1
    Bumps patch, writes the zip, commits + pushes to the current branch.

.EXAMPLE
    ./release.ps1 minor -SkipPush
    Bumps minor and commits locally, but doesn't push.
#>

[CmdletBinding()]
param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Bump = 'patch',
    [switch]$SkipPush,
    [switch]$NoGit
)

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path -Parent $MyInvocation.MyCommand.Path
$moduleDir  = Join-Path $repoRoot 'modules/1547core'
$manifest   = Join-Path $moduleDir 'module.json'
$zipPath    = Join-Path $repoRoot '1547core.zip'

if (-not (Test-Path $manifest)) {
    throw "Manifest not found: $manifest"
}

# --- Read & bump version ----------------------------------------------------

$json    = Get-Content $manifest -Raw
$module  = $json | ConvertFrom-Json
$oldVer  = [string]$module.version

if ($oldVer -notmatch '^\s*(\d+)\.(\d+)\.(\d+)\s*$') {
    throw "Cannot parse version '$oldVer' - expected MAJOR.MINOR.PATCH"
}
$major = [int]$Matches[1]
$minor = [int]$Matches[2]
$patch = [int]$Matches[3]

switch ($Bump) {
    'major' { $major++; $minor = 0; $patch = 0 }
    'minor' { $minor++; $patch = 0 }
    'patch' { $patch++ }
}
$newVer = "$major.$minor.$patch"

$module.version = $newVer
# UTF-8 without BOM (PS 5.1's -Encoding utf8 writes a BOM, which dirties diffs).
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    $manifest,
    (($module | ConvertTo-Json -Depth 100) + "`r`n"),
    $utf8NoBom
)

Write-Output "Version: $oldVer -> $newVer"

# --- Build the zip ----------------------------------------------------------

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

# Resolve full paths because CreateFromDirectory needs absolutes.
$absModuleDir = (Resolve-Path $moduleDir).Path
$absZipPath   = [System.IO.Path]::GetFullPath($zipPath)

# 4th arg $true = include the base directory ("1547core/") inside the archive.
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $absModuleDir,
    $absZipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $true
)

$sizeKb = [math]::Round((Get-Item $zipPath).Length / 1024, 1)
Write-Output ("Wrote: {0} ({1} KB)" -f $zipPath, $sizeKb)

# --- Git: commit + push -----------------------------------------------------

if ($NoGit) {
    Write-Output "Skipped git (-NoGit). Commit + push manually when ready."
    return
}

Push-Location $repoRoot
try {
    $manifestRel = 'modules/1547core/module.json'
    $zipRel      = '1547core.zip'

    # Stage only the release artifacts; other working-tree changes are left alone.
    & git add -- $manifestRel $zipRel
    if ($LASTEXITCODE -ne 0) { throw "git add failed (exit $LASTEXITCODE)" }

    # If nothing staged (e.g. version was unchanged on a previous run), bail gracefully.
    & git diff --cached --quiet -- $manifestRel $zipRel
    if ($LASTEXITCODE -eq 0) {
        Write-Output "Nothing to commit (release artifacts unchanged)."
        return
    }

    $commitMsg = "release: 1547core $newVer"
    & git commit -m $commitMsg
    if ($LASTEXITCODE -ne 0) { throw "git commit failed (exit $LASTEXITCODE)" }
    Write-Output ("Committed: {0}" -f $commitMsg)

    if ($SkipPush) {
        Write-Output "Skipped push (-SkipPush). Push manually when ready."
        return
    }

    & git push
    if ($LASTEXITCODE -ne 0) { throw "git push failed (exit $LASTEXITCODE)" }
    Write-Output "Pushed."
}
finally {
    Pop-Location
}
