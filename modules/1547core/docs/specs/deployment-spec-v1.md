# 1547 Core Deployment Spec v1

## Purpose

This document records the deployment process for `1547core`, with special care
for Sqyre-hosted Foundry VTT installs.

The goal is to avoid recurring deployment failures caused by:

- stale browser or host cache
- unchanged version numbers
- invalid zip structure
- Windows-style zip entry paths
- UTF-8 BOM in `module.json`

## Deployment Targets

Primary deployment target:

- Sqyre asset upload using a zip archive

Secondary metadata target:

- public GitHub manifest and download URLs

## Required Manifest Rules

The module manifest must live at:

- `modules/1547core/module.json`

Required manifest fields:

- `id: "1547core"`
- `title: "1547 Core"`
- incremented `version`
- correct `url`
- correct `manifest`
- correct `download`

Current expected URLs:

- `url`: `https://github.com/KaiSevelin/Enrich1547`
- `manifest`: `https://raw.githubusercontent.com/KaiSevelin/Enrich1547/master/modules/1547core/module.json`
- `download`: `https://raw.githubusercontent.com/KaiSevelin/Enrich1547/master/1547core.zip`

## Source File Stability Rule

Do not rename source files, folders, or module paths unless the user explicitly
asks for that rename.

This includes:

- files under `modules/1547core`
- manifest paths
- exported Foundry JSON filenames
- template files
- script paths
- zip root naming assumptions

Reason:

- renames can create long-running deployment and cache problems
- hosted environments may retain stale paths
- manifest, archive, and runtime references can silently drift
- exported Foundry content may depend on stable filenames and locations

Default rule:

- preserve existing filenames and paths
- only change contents unless a rename is explicitly requested

## Versioning Rule

Sqyre requires a new version for each upload attempt.

Deployment rule:

- bump the patch version on every deployment build

Example:

- `0.0.48` -> `0.0.49`

Do not reuse a previously uploaded version number.

## Encoding Rule

`module.json` must be UTF-8 without BOM.

This is critical. A BOM in `module.json` can cause Sqyre to fail package
identification and return an empty `packageId`.

Symptoms seen when this fails:

- upload returns `400`
- response body includes:
  - `"packageId": ""`
  - `"Missing or bad parameters"`

Validation rule:

- first byte of `module.json` must be `{` (`123`)
- it must not begin with bytes `239 187 191`

## Zip Structure Rules

The upload archive must be a flat module zip.

The zip root must contain:

- `module.json`
- `scripts/...`
- `styles/...`
- `templates/...`
- `foundry/...`
- `docs/...`

It must not contain:

- an extra wrapping folder such as `1547core/module.json`

## Zip Path Rules

Zip entry names must use forward slashes.

Valid:

- `scripts/main.js`
- `foundry/weapons.json`

Invalid:

- `scripts\\main.js`
- `foundry\\weapons.json`

Sqyre may fail to parse the package correctly if Windows-style backslashes are
stored in the archive.

## Zip Reliability Rule

Avoid archive-building methods that have already produced corrupted zip files in
this workspace.

Known reliable method on this project:

- build a flat staging directory first
- copy the module contents into that staging directory
- create the zip from the staging directory contents

Preferred package contents to stage:

- `module.json`
- `scripts`
- `styles`
- `templates`
- `foundry`
- `docs`

Do not assume a newly created zip is valid just because the archive command did
not fail.

After creating the zip, always validate that:

1. the zip can be opened successfully
2. `module.json` exists at zip root
3. the embedded manifest can be parsed
4. the embedded version matches the local manifest
5. the embedded `module.json` has no BOM

Operational preference:

- prefer the staging-directory zip method over lower-level custom zip creation
  if there is any sign of archive corruption

Failure sign seen in this project:

- .NET zip reader error equivalent to ?central directory is corrupted?

If that occurs:

1. discard the zip
2. rebuild from a fresh staging directory
3. validate the rebuilt archive before upload

## Local Validation Command

Run this before building or uploading:

- `node modules/1547core/scripts/validation/validate-module.mjs`

What it currently checks:

- `module.json` exists, parses, and has no BOM
- HUD structural markers are present and in expected order
- HUD brace balance returns to zero
- duplicated critical HUD helpers are caught
- CSB weapon trait formula does not end with the bad trailing comma pattern

Note:

- in this sandbox, nested Node process syntax checks may be skipped
- in normal local use, this command is still the first pre-deployment validation step

## Test Plan Rule

Every deployment build must also produce a clean manual Foundry test plan
for the current change set.

Deployment rule:

- create a clean test plan for the current build or fully reset the existing one
- do not carry forward old pass/fail marks or notes into the new deployment test plan
- include tests for the features changed in the current build
- do this before packaging the zip

Primary test plan file for this project:

- `modules/1547core/docs/manual-test-plan.md`

Minimum expectation for each deploy:

1. review the current change set
2. create or reset the manual test plan into a clean checklist state
3. add or update manual test steps that cover those changes
4. save the clean test plan in the repo
5. only then continue to build and zip

## Build Checklist

Before building:

1. Ensure `module.json` uses id `1547core`
2. Update manifest/download URLs if repo paths changed
3. Bump the patch version
4. Save `module.json` without BOM

Build archive with:

1. zip root = module contents, not enclosing folder
2. forward-slash entry names
3. include:
   - `module.json`
   - `scripts`
   - `styles`
   - `templates`
   - `foundry`
   - `docs`

After building:

1. verify `module.json` exists at zip root
2. verify zipped `module.json` has no BOM
3. verify zipped entry paths use `/`
4. verify embedded version matches local version

## GitHub Checklist

Before testing remote installs:

1. push `modules/1547core/module.json`
2. push `1547core.zip`
3. verify raw URLs load publicly
4. verify raw manifest version matches local version

Required manual checks:

- manifest URL opens
- download URL downloads
- raw manifest shows expected `id`
- raw manifest shows expected `version`

## Sqyre Upload Checklist

Recommended sequence:

1. upload the newly built `1547core.zip`
2. hard refresh Sqyre / browser
3. install or update module
4. if install behaves strangely, hard refresh again

If upload fails:

1. open browser devtools
2. inspect failing `assets.sqyre.app/upload` request
3. read response body

Important interpretation:

- `packageId: ""` strongly suggests Sqyre could not read a valid `module.json`
- first suspects should be:
  - BOM in `module.json`
  - wrong zip root structure
  - backslash zip entry paths

## Post-Install Validation

After installation:

1. enable module
2. enter world as GM
3. confirm module settings appear
4. confirm HUD loads on token selection
5. watch browser console for red errors

## Known Good Package Properties

A known good `1547core.zip` has all of these:

- flat root
- `module.json` at root
- forward-slash entry names
- `module.json` without BOM
- bumped version
- public manifest and download URLs matching GitHub

## Error Resolution Rules

When a deployment or packaging step fails, record the exact failure pattern and
apply the known resolution instead of improvising a new packaging method.

### Zip Entry Path Truncation

Failure pattern:

- zip validation shows entries like `odule.json` or `ocs/...`
- validation reports `module.json missing at zip root` even though the archive
  was just built

Cause:

- incorrect relative-path trimming while creating zip entries
- string slicing removed the first character of each staged path

Resolution:

1. inspect actual zip entry names before upload
2. rebuild the zip using a safe relative-path calculation
3. do not upload until `module.json` appears exactly at zip root

Rule:

- never trust a successful zip command alone; always inspect entry names if root
  validation fails

### PowerShell / .NET Relative Path Compatibility

Failure pattern:

- `[System.IO.Path]::GetRelativePath` is missing
- build script fails on older PowerShell or .NET runtime methods

Cause:

- host environment does not provide newer .NET helper methods

Resolution:

1. avoid depending on `GetRelativePath` in deployment scripts
2. use a compatibility-safe relative path method, such as regex removal of the
   staging root prefix
3. validate the resulting zip entries immediately afterward

Rule:

- prefer conservative path handling that works on older PowerShell/.NET
  environments

### Template-String Heavy File Patching

Failure pattern:

- Node inline patch script fails with syntax errors while editing large HTML/JS
  template strings
- PowerShell inline replacement fails because of quoting or terminator issues

Cause:

- large embedded template strings are brittle under ad-hoc escaping

Resolution:

1. avoid giant one-shot replacement scripts when patching HUD markup blocks
2. prefer smaller, boundary-based replacements
3. if Node escaping becomes brittle, switch to PowerShell here-strings carefully
4. immediately run targeted syntax checks and the validator after the edit

Rule:

- for large HUD/template edits, use the most conservative patching method and
  validate right away

### Test Plan Drift

Failure pattern:

- deployment succeeds but the manual test plan still describes old fields or old
  UI structure
- new features are shipped without matching manual verification steps

Cause:

- test plan not updated as part of the deployment workflow

Resolution:

1. reset or recreate the relevant manual test plan before packaging
2. make sure field names match the current implementation
3. remove old results so the plan is clean for the new deploy
4. add explicit checks for the features changed in the current build

Rule:

- no deploy is complete until the test plan matches the shipped build

## Failure Signatures

### Upload rejected with 400

Likely causes:

- bad zip structure
- invalid package metadata
- BOM in `module.json`
- stale version reuse

### `packageId` is empty in Sqyre response

Most likely causes:

- `module.json` unreadable
- `module.json` not found where expected
- BOM in `module.json`

### Foundry install works only after hard refresh

Likely cause:

- browser or Sqyre cache

### Module installs but settings do not appear

Likely causes:

- runtime startup/import failure
- stale cached JS

## Operational Rule

For every deployment build:

1. bump version
2. remove BOM from `module.json`
3. build flat zip with forward slashes
4. verify embedded manifest
5. upload
6. hard refresh
