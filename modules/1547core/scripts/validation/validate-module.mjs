import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const ROOT = path.resolve("modules/1547core");
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const MODULE_JSON = path.join(ROOT, "module.json");
const HUD_FILE = path.join(ROOT, "scripts", "hud", "actor-hud.js");
const HUD_ACTIONS_FILE = path.join(ROOT, "scripts", "hud", "hud-actions.js");

const failures = [];
const passes = [];
const skips = [];
const warnings = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function skip(message) {
  skips.push(message);
}

function warn(message) {
  warnings.push(message);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function walkFiles(dir, matcher, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, matcher, results);
    } else if (matcher(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkModuleJson() {
  const bytes = fs.readFileSync(MODULE_JSON);
  assert(bytes[0] === 0x7b, "module.json starts with '{' (no BOM)");
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), "module.json has no UTF-8 BOM");

  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(MODULE_JSON, "utf8"));
    pass("module.json parses as JSON");
  } catch (error) {
    fail(`module.json parses as JSON: ${error.message}`);
    return;
  }

  assert(manifest.id === "1547core", "module.json id is 1547core");
  assert(typeof manifest.version === "string" && /^\d+\.\d+\.\d+$/.test(manifest.version), "module.json version looks like x.y.z");
}

function checkJavaScriptSyntax() {
  const jsFiles = walkFiles(SCRIPTS_DIR, (file) => file.endsWith(".js"));
  const tempFile = path.join(ROOT, ".validation-check.mjs");
  try {
    for (const file of jsFiles) {
      fs.writeFileSync(tempFile, fs.readFileSync(file, "utf8"), "utf8");
      try {
        const result = spawnSync(process.execPath, ["--check", tempFile], { encoding: "utf8" });
        if (result.error?.code === "EPERM") {
          skip(`JS syntax check skipped by sandbox: ${path.relative(ROOT, file)}`);
        } else if (result.status === 0) {
          pass(`JS syntax ok: ${path.relative(ROOT, file)}`);
        } else {
          const stderr = result.stderr?.trim() || result.stdout?.trim() || result.error?.message || "unknown parse failure";
          fail(`JS syntax ok: ${path.relative(ROOT, file)} :: ${stderr}`);
        }
      } catch (error) {
        fail(`JS syntax ok: ${path.relative(ROOT, file)} :: ${error.message}`);
      }
    }
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

function computeBraceBalance(source) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "\n") {
      inLineComment = false;
      escape = false;
      continue;
    }
    if (inLineComment) continue;
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (!escape && ch === "'") inSingle = false;
      escape = !escape && ch === "\\";
      continue;
    }
    if (inDouble) {
      if (!escape && ch === '"') inDouble = false;
      escape = !escape && ch === "\\";
      continue;
    }
    if (inTemplate) {
      if (!escape && ch === "`") {
        inTemplate = false;
        continue;
      }
      if (!escape && ch === "$" && next === "{") {
        depth += 1;
        i += 1;
        continue;
      }
      if (ch === "}" && depth > 0) {
        depth -= 1;
        continue;
      }
      escape = !escape && ch === "\\";
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      escape = false;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      escape = false;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      escape = false;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }

  return depth;
}

function checkHudStructure() {
  const hud = fs.readFileSync(HUD_FILE, "utf8");
  const hudActions = fs.readFileSync(HUD_ACTIONS_FILE, "utf8");

  const actorHudMarkers = [
    "function getAmmoSummary(item) {",
    "function getWeaponAttackState(weapon, {",
    "function getThreatSource(actor) {",
    "function getRangedSource(actor) {",
    "export function register1547ActorHud() {"
  ];

  let previousIndex = -1;
  for (const marker of actorHudMarkers) {
    const index = hud.indexOf(marker);
    assert(index !== -1, `HUD marker exists: ${marker}`);
    if (index !== -1) {
      assert(index > previousIndex, `HUD marker order ok: ${marker}`);
      previousIndex = index;
    }
  }

  const actionMarkers = [
    "async function executeStatAction(descriptor, context, evaluation, deps = {}) {",
    "async function executeSkillAction(descriptor, context, evaluation, deps = {}) {",
    "const HUD_ACTION_HANDLERS = {",
    '"roll-stat": {',
    "execute: executeStatAction"
  ];

  let previousActionIndex = -1;
  for (const marker of actionMarkers) {
    const index = hudActions.indexOf(marker);
    assert(index !== -1, `HUD action marker exists: ${marker}`);
    if (index !== -1) {
      assert(index > previousActionIndex, `HUD action marker order ok: ${marker}`);
      previousActionIndex = index;
    }
  }

  const braceBalance = computeBraceBalance(hud);
  assert(braceBalance === 0, `HUD brace balance returns to zero (got ${braceBalance})`);

  const duplicatedThreatSource = (hud.match(/function getThreatSource\(actor\) \{/g) || []).length;
  assert(duplicatedThreatSource === 1, `HUD has one getThreatSource definition (got ${duplicatedThreatSource})`);

  const ammoSummaryBlock = hud.slice(hud.indexOf("function getAmmoSummary(item) {"), hud.indexOf("function getWeaponAttackState(weapon, {"));
  assert(ammoSummaryBlock.includes('return [addDiceSummary, tagsSummary, modifiersSummary].filter(Boolean).join(" | ");'), "HUD ammo summary returns combined summary text");
}
function checkDuplicateFunctionDefinitions() {
  const jsFiles = walkFiles(SCRIPTS_DIR, (file) => file.endsWith(".js"));
  const allowedDuplicates = new Map();

  for (const file of jsFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(ROOT, file);
    const counts = new Map();

    const declarationPatterns = [
      /(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g,
      /(?:^|\n)async\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
      /(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
      /(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>/g
    ];

    for (const pattern of declarationPatterns) {
      for (const match of source.matchAll(pattern)) {
        const name = match[1];
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }

    const duplicates = [...counts.entries()]
      .filter(([name, count]) => count > (allowedDuplicates.get(relative + ":" + name) ?? 1))
      .map(([name, count]) => name + " x" + count);

    const suffix = duplicates.length ? " :: " + duplicates.join(", ") : "";
    assert(duplicates.length === 0, `No duplicate function definitions in ${relative}${suffix}`);
  }
}
function checkCsbTraitFormula() {
  const templatePath = path.join(ROOT, "foundry", "Templates", "fvtt-Item-weapontemplate-qZCfLEYQ7egbm1B9.json");
  const templateText = fs.readFileSync(templatePath, "utf8");
  assert(!templateText.includes('Traits_Tactical ? "Traits_Tactical," : "",\r\n)'), "Weapon template trait formula has no trailing comma before closing concat");
  assert(!templateText.includes('Traits_Tactical ? "Traits_Tactical," : "",\n)'), "Weapon template trait formula has no trailing comma before closing concat");
}

function checkCrossFileDuplicateFunctions() {
  const jsFiles = walkFiles(SCRIPTS_DIR, (file) => file.endsWith(".js"));
  const declarationPatterns = [
    /(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:^|\n)async\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:^|\n)export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:^|\n)export\s+async\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
  ];

  const nameToFiles = new Map();
  for (const file of jsFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(ROOT, file);
    const namesInFile = new Set();
    for (const pattern of declarationPatterns) {
      for (const match of source.matchAll(pattern)) {
        namesInFile.add(match[1]);
      }
    }
    for (const name of namesInFile) {
      if (!nameToFiles.has(name)) nameToFiles.set(name, []);
      nameToFiles.get(name).push(relative);
    }
  }

  const duplicates = [];
  for (const [name, files] of nameToFiles.entries()) {
    if (files.length < 2) continue;
    duplicates.push({ name, files });
  }

  if (!duplicates.length) {
    pass("No cross-file duplicate function declarations");
    return;
  }

  duplicates.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of duplicates) {
    warn(`Cross-file duplicate function: ${entry.name} in ${entry.files.join(", ")}`);
  }
}

async function checkSpellExportDrift() {
  const templatePath = path.join(ROOT, "foundry", "Templates", "fvtt-Item-spelltemplate-2kiWw3Cv5Zk1lZxn.json");
  const sourcePath = path.join(ROOT, "foundry", "Templates", "spells.json");
  const bundlePath = path.join(ROOT, "foundry", "Templates", "fvtt-Items-spells.json");
  const spellsDir = path.join(ROOT, "foundry", "Spells");

  let makeItemDoc;
  try {
    ({ makeItemDoc } = await import("../tools/generate-spell-exports.mjs"));
  } catch (error) {
    fail(`Spell export generator is importable: ${error.message}`);
    return;
  }

  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  assert(source.length === bundle.length, `Spell bundle entry count matches source (${bundle.length}/${source.length})`);

  const bundleById = new Map(bundle.map((doc) => [doc._id, doc]));
  const drifted = [];
  for (const spell of source) {
    const expected = JSON.stringify(makeItemDoc(spell, template));
    const actual = JSON.stringify(bundleById.get(spell._id) ?? null);
    if (expected !== actual) drifted.push(spell._id ?? spell.name);
  }
  const driftSuffix = drifted.length
    ? ` :: ${drifted.length} drifted (e.g. ${drifted.slice(0, 3).join(", ")}); re-run scripts/tools/generate-spell-exports.mjs`
    : "";
  assert(drifted.length === 0, `Spell bundle is in sync with spells.json${driftSuffix}`);

  const individualDrift = [];
  for (const name of fs.readdirSync(spellsDir).filter((entry) => /^fvtt-Item-.*\.json$/i.test(entry))) {
    const doc = JSON.parse(fs.readFileSync(path.join(spellsDir, name), "utf8"));
    const counterpart = bundleById.get(doc._id);
    if (!counterpart || JSON.stringify(doc) !== JSON.stringify(counterpart)) individualDrift.push(name);
  }
  const individualSuffix = individualDrift.length
    ? ` :: ${individualDrift.length} mismatched (e.g. ${individualDrift.slice(0, 3).join(", ")}); re-run scripts/tools/generate-spell-exports.mjs`
    : "";
  assert(individualDrift.length === 0, `Individual spell exports match the bundle${individualSuffix}`);
}

checkModuleJson();
checkJavaScriptSyntax();
checkHudStructure();
checkCsbTraitFormula();
checkDuplicateFunctionDefinitions();
checkCrossFileDuplicateFunctions();
await checkSpellExportDrift();

for (const message of passes) console.log(`PASS ${message}`);
for (const message of skips) console.log(`SKIP ${message}`);
for (const message of warnings) console.warn(`WARN ${message}`);
for (const message of failures) console.error(`FAIL ${message}`);

if (failures.length) {
  console.error(`\nValidation failed: ${failures.length} issue(s)`);
  process.exit(1);
}

const warningSuffix = warnings.length ? `, ${warnings.length} warning(s)` : "";
console.log(`\nValidation passed: ${passes.length} checks, ${skips.length} skipped${warningSuffix}`);


