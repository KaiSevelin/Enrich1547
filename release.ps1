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
    - Stages every change under modules/1547core/ AND 1547core.zip so
      source and zip can't drift. Honors .gitignore (so *.bak files
      etc. are skipped). Working-tree changes outside the module are
      left untouched.
    - Commits with "release: 1547core <version>" and pushes the
      current branch.
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

# --- Build compendium packs -------------------------------------------------
# Regenerate modules/1547core/packs/*/ from foundry/Templates/*.json so the
# release ships with up-to-date compendium content. Assumes `npm install` has
# already been run inside the module directory.

Push-Location $moduleDir
try {
    & npm run build-packs
    if ($LASTEXITCODE -ne 0) { throw "npm run build-packs failed (exit $LASTEXITCODE)" }
}
finally {
    Pop-Location
}

# --- Build the zip ----------------------------------------------------------

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

# Resolve full paths because CreateFromDirectory needs absolutes.
$absModuleDir = (Resolve-Path $moduleDir).Path
$absZipPath   = [System.IO.Path]::GetFullPath($zipPath)

# Stage a copy of the module dir with build artifacts excluded — we don't want
# node_modules/ (dev deps) or pack-source/ (intermediate JSON) in the release.
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("1547core-release-" + [guid]::NewGuid().ToString("N"))
$stagingModuleDir = Join-Path $stagingRoot "1547core"
New-Item -ItemType Directory -Path $stagingModuleDir -Force | Out-Null

# robocopy is the most reliable way to do a recursive copy with directory
# exclusions on Windows. /MIR mirrors, /XD excludes named directories.
& robocopy $absModuleDir $stagingModuleDir /MIR /XD "node_modules" "pack-source" /NFL /NDL /NJH /NJS /NP /NS | Out-Null
# robocopy returns 0-7 for success, 8+ for failure. Force the exit code
# back to 0 so the bleed-through doesn't fail later checks or the script.
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }
& cmd /c exit 0

try {
    # 4th arg $true = include the base directory ("1547core/") inside the archive.
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingRoot,
        $absZipPath,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )
}
finally {
    Remove-Item $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$sizeKb = [math]::Round((Get-Item $zipPath).Length / 1024, 1)
Write-Output ("Wrote: {0} ({1} KB)" -f $zipPath, $sizeKb)

# --- Git: commit + push -----------------------------------------------------

if ($NoGit) {
    Write-Output "Skipped git (-NoGit). Commit + push manually when ready."
    return
}

Push-Location $repoRoot
# Lower ErrorActionPreference for the git block. Git emits harmless
# warnings (e.g. "LF will be replaced by CRLF") to stderr, which
# `$ErrorActionPreference = 'Stop'` would otherwise treat as terminating
# errors — aborting the script before the commit step. Every git
# invocation below already checks $LASTEXITCODE explicitly, so real
# failures are still caught.
$prevErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $moduleRel = 'modules/1547core'
    $zipRel    = '1547core.zip'

    # Stage the whole module dir (modified + new tracked-eligible files)
    # plus the zip. Source and zip stay in sync; .gitignore'd files
    # (e.g. *.bak) are skipped. Changes outside the module are not touched.
    & git add -- $moduleRel $zipRel
    if ($LASTEXITCODE -ne 0) { throw "git add failed (exit $LASTEXITCODE)" }

    # If nothing staged (e.g. re-run with no changes), bail gracefully.
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Output "Nothing to commit (no changes under $moduleRel or in the zip)."
        return
    }

    # Show what we're about to commit so surprises are visible.
    Write-Output ""
    Write-Output "Staged for release:"
    & git diff --cached --name-status
    Write-Output ""

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
    $ErrorActionPreference = $prevErrorPreference
    Pop-Location
}
