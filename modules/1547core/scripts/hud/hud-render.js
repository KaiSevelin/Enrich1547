import { getStatTooltip } from "./stat-info.js";
import { getConditionDescription } from "../services/condition-registry.js";

function renderPills(entries, deps = {}) {
    const { escapeHtml } = deps;
    if (!entries.length) return `<span class="hud-empty-pill">None</span>`;
    return entries.map((entry) => `
        <span class="hud-pill">
            <span class="hud-pill-label">${escapeHtml(entry.label)}</span>
            <span class="hud-pill-value">${escapeHtml(entry.value)}</span>
        </span>
    `).join("");
}

function buildTreeList(items, formatter) {
    if (!items.length) return `<li class="hud-empty-row">None</li>`;
    return items.map((item) => formatter(item)).join("");
}

function groupEntries(entries, grouper) {
    const groups = new Map();
    for (const entry of entries) {
        const key = grouper(entry) || "Other";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    }
    return Array.from(groups.entries());
}

function buildGroupedTree(groups, formatter, deps = {}, options = {}) {
    const { escapeHtml } = deps;
    const { scroll = false, openFirst = true } = options;
    if (!groups.length) return `<div class="hud-empty-row">None</div>`;
    return groups.map(([label, entries], index) => `
        <details class="hud-tree-group"${openFirst && index === 0 ? " open" : ""}>
            <summary class="hud-tree-summary">
                <span>${escapeHtml(label)}</span>
                <span class="hud-tree-badge">${escapeHtml(entries.length)}</span>
            </summary>
            <ul class="hud-list hud-tree-list${scroll ? " hud-list-scroll" : ""}">
                ${buildTreeList(entries, formatter)}
            </ul>
        </details>
    `).join("");
}

function buildStatsTree(data, deps = {}) {
    const { escapeHtml } = deps;
    const statRows = data.stats.map((stat) => `<li title="${escapeHtml(getStatTooltip(stat.label, stat.formula))}"><span class="hud-tree-key">${escapeHtml(stat.label)}</span><span class="hud-tree-value">${escapeHtml(stat.formula)}</span></li>`).join("");
    const resourceRows = data.pointPools.map((resource) => `<li><span class="hud-tree-key">${escapeHtml(resource.label)}</span><span class="hud-tree-value">${escapeHtml(resource.display)}</span></li>`).join("");
    return `
        <div class="hud-tree-block">
            <div class="hud-section-title">Stats</div>
            <ul class="hud-tree-children hud-tree-compact">${statRows || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Resources</div>
            <ul class="hud-tree-children hud-tree-compact">${resourceRows || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
    `;
}

function buildCombatActionPanel(data, deps = {}, activeView = "equipped") {
    const { escapeHtml } = deps;
    const action = data.currentAction ?? {};
    const maneuverText = (action.preManeuverNames ?? []).length ? action.preManeuverNames.join(", ") : "None";
    const fullTurnText = action.fullTurnName || "None";
    const stagedText = [action.stagedAttackDice, action.stagedSkillDice].filter(Boolean).join(" | ") || "None";
    const targetText = action.targetName || "No target";
    const previewText = action.attackPreview || "No attack preview";
    return `
        <div class="hud-tree-block hud-attack-setup">
            <div class="hud-section-title">Attack Setup</div>
            <div class="hud-current-action-grid">
                <div class="hud-current-action-row">
                    <span class="hud-tree-key">Target</span>
                    <span class="hud-tree-value">${escapeHtml(targetText)}</span>
                </div>
                <div class="hud-current-action-row">
                    <span class="hud-tree-key">Pre Maneuvers</span>
                    <span class="hud-tree-value">${escapeHtml(maneuverText)}</span>
                </div>
                <div class="hud-current-action-row">
                    <span class="hud-tree-key">Full Turn</span>
                    <span class="hud-tree-value">${escapeHtml(fullTurnText)}</span>
                </div>
                <div class="hud-current-action-row">
                    <span class="hud-tree-key">Staged Dice</span>
                    <span class="hud-tree-value">${escapeHtml(stagedText)}</span>
                </div>
                <div class="hud-current-action-row hud-current-action-row-preview">
                    <span class="hud-tree-key">Attack Preview</span>
                    <span class="hud-tree-value">${escapeHtml(previewText)}</span>
                </div>
            </div>
            <div class="hud-setup-actions">
                <button type="button" class="hud-mini-button${activeView === "equipped" ? " is-active" : ""}" data-hud-category="equipped">Attack</button>
                <button type="button" class="hud-mini-button${activeView === "maneuvers" ? " is-active" : ""}" data-hud-category="maneuvers">Maneuvers</button>
                <button type="button" class="hud-mini-button${activeView === "dice" ? " is-active" : ""}" data-hud-category="dice">Dice</button>
                <button type="button" class="hud-mini-button${activeView === "skills" ? " is-active" : ""}" data-hud-category="skills">Skills</button>
            </div>
        </div>
    `;
}

function buildEquippedTree(data, deps = {}) {
    const { escapeHtml } = deps;
    const equippedWeaponRows = data.equippedWeapons.length
        ? buildTreeList(data.equippedWeapons, (weapon) => {
            const profileButtons = weapon.attackProfiles.map((profile) => `
                <button
                    type="button"
                    class="hud-mini-button${profile.key === weapon.activeAttackProfile ? " is-active" : ""}"
                    data-hud-weapon-profile="${escapeHtml(weapon.id)}"
                    data-hud-profile-key="${escapeHtml(profile.key)}"
                >
                    ${escapeHtml(profile.label)}
                </button>
            `).join("");
            const ammoButtons = weapon.usesAmmo
                ? weapon.compatibleAmmo.length
                    ? weapon.compatibleAmmo.map((ammo) => `
                        <button
                            type="button"
                            class="hud-mini-button${ammo.id === (weapon.selectedAmmoId ?? weapon.loadedAmmoId) ? " is-active" : ""}"
                            data-hud-weapon-ammo="${escapeHtml(weapon.id)}"
                            data-hud-ammo-id="${escapeHtml(ammo.id)}"
                            data-hud-profile-id="${escapeHtml(weapon.activeAttackProfileId ?? "")}"
                        >
                            ${escapeHtml(`${ammo.name} x${ammo.quantity}`)}
                        </button>
                    `).join("")
                    : `<span class="hud-empty-pill">No compatible ammo</span>`
                : "";

            // Append (loaded) / (not loaded) only for ammo-using weapons; the
            // standalone Loaded Ammo row is removed in favour of this suffix.
            const ammoSuffix = weapon.usesAmmo
                ? (weapon.loadedAmmoName ? ` (loaded: ${weapon.loadedAmmoName})` : " (not loaded)")
                : "";
            // Inline profile selector with the title row, but only when the
            // weapon has more than one profile — single-profile weapons would
            // just show a redundant chip.
            const inlineProfilePicker = weapon.attackProfiles.length > 1
                ? `<div class="hud-chip-row hud-chip-row-inline">${profileButtons}</div>`
                : "";
            // Range/reach pills hide behind a Range button so two ranged
            // weapons don't crowd the equipped tab with always-on numbers.
            const hasReach = Number(weapon.minReach) > 0 || Number(weapon.maxReach) > 0;
            const hasRangeBands = Number(weapon.shortRange) > 0 || Number(weapon.longRange) > 0 || Number(weapon.maxRange) > 0;
            const hasRangeOrReach = hasReach || hasRangeBands;
            const rangeShown = Boolean(deps.HUD_STATE?.weaponRangeShownIds?.[weapon.id]);
            const rangePills = (() => {
                const parts = [];
                if (hasReach) {
                    const min = Number(weapon.minReach) || 0;
                    const max = Number(weapon.maxReach) || min;
                    const label = max && max !== min ? `${min}-${max}` : String(min || max);
                    parts.push(`<span class="hud-pill"><span class="hud-pill-label">Reach</span><span class="hud-pill-value">${escapeHtml(label)}</span></span>`);
                }
                if (Number(weapon.shortRange) > 0) parts.push(`<span class="hud-pill"><span class="hud-pill-label">Short</span><span class="hud-pill-value">${escapeHtml(weapon.shortRange)}</span></span>`);
                if (Number(weapon.longRange) > 0) parts.push(`<span class="hud-pill"><span class="hud-pill-label">Long</span><span class="hud-pill-value">${escapeHtml(weapon.longRange)}</span></span>`);
                if (Number(weapon.maxRange) > 0) parts.push(`<span class="hud-pill"><span class="hud-pill-label">Max</span><span class="hud-pill-value">${escapeHtml(weapon.maxRange)}</span></span>`);
                return parts.join("");
            })();
            // Multi-mode weapons (e.g. Rapier: Bind / Thrust) list each mode's
            // damage dice in the hover tooltip.
            const modeTip = (weapon.attackProfiles ?? []).length > 1
                ? weapon.attackProfiles
                    .map((p) => `${p.label}: ${(p.dice ?? []).join(", ") || p.formula || "-"}`)
                    .join("\n")
                : "";
            const weaponTooltip = [weapon.tooltip || weapon.name, modeTip].filter(Boolean).join("\n");
            return `
                <li class="hud-tree-item hud-weapon-card" title="${escapeHtml(weaponTooltip)}">
                    <div class="hud-weapon-title-row">
                        <div class="hud-row-main">${escapeHtml(`${weapon.name}${ammoSuffix}`)}</div>
                        ${inlineProfilePicker}
                    </div>
                    <div class="hud-row-sub">${escapeHtml([weapon.equipped ? "Equipped" : "Carried", weapon.type].filter(Boolean).join(" - "))}</div>
                    <div class="hud-weapon-action-strip">
                        <button
                            type="button"
                            class="hud-mini-button hud-mini-button-primary"
                            data-hud-weapon-attack="${escapeHtml(weapon.id)}"
                        >
                            Attack
                        </button>
                        ${hasRangeOrReach ? `
                            <button
                                type="button"
                                class="hud-mini-button${rangeShown ? " is-active" : ""}"
                                data-hud-weapon-range="${escapeHtml(weapon.id)}"
                            >
                                Range
                            </button>
                        ` : ""}
                        ${weapon.usesAmmo ? `
                            <button
                                type="button"
                                class="hud-mini-button"
                                data-hud-weapon-reload="${escapeHtml(weapon.id)}"
                            >
                                Reload
                            </button>
                        ` : ""}
                        ${weapon.type === "Unarmed" || weapon.name === "Unarmed" ? "" : `
                            <button
                                type="button"
                                class="hud-mini-button"
                                data-hud-item-unequip="${escapeHtml(weapon.id)}"
                            >
                                Unequip
                            </button>
                        `}
                    </div>
                    ${rangeShown && rangePills ? `<div class="hud-pill-row hud-weapon-range-pills">${rangePills}</div>` : ""}
                    <div class="hud-weapon-action-status ${weapon.attackState?.status === "valid" ? "is-valid" : "is-invalid"}">${escapeHtml(weapon.attackState?.label || "Unavailable")}</div>
                    <div class="hud-row-sub">${escapeHtml(weapon.attackState?.reason || "")}</div>
                    <ul class="hud-tree-children hud-tree-compact">
                        <li><span class="hud-tree-key">Active</span><span class="hud-tree-value">${escapeHtml(weapon.activeAttackFormula || "-")}</span></li>
                        ${weapon.weaponModifierSummary ? `<li><span class="hud-tree-key">Modifiers</span><span class="hud-tree-value">${escapeHtml(weapon.weaponModifierSummary)}</span></li>` : ""}
                        ${weapon.usesAmmo && weapon.ammoModifierSummary ? `<li><span class="hud-tree-key">Ammo Mods</span><span class="hud-tree-value">${escapeHtml(weapon.ammoModifierSummary)}</span></li>` : ""}
                    </ul>
                    ${weapon.usesAmmo ? `
                        <div class="hud-weapon-controls">
                            <div class="hud-weapon-control-group">
                                <div class="hud-weapon-control-label">Ammo</div>
                                <div class="hud-chip-row">${ammoButtons}</div>
                            </div>
                        </div>
                    ` : ""}
                </li>
            `;
        })
        : `<li class="hud-empty-row">No equipped weapons</li>`;

    const equippedArmorRows = data.equippedArmor.length
        ? buildTreeList(data.equippedArmor, (armor) => `
            <li class="hud-tree-item" title="${escapeHtml(armor.tooltip || armor.name)}">
                <div class="hud-row-main">${escapeHtml(armor.name)}</div>
                <div class="hud-row-sub">${escapeHtml(armor.defense || armor.type || "Equipped")}</div>
                <div class="hud-weapon-action-strip">
                    ${armor.isVirtualDefault || armor.name === "Unprotected" ? "" : `
                        <button
                            type="button"
                            class="hud-mini-button"
                            data-hud-item-unequip="${escapeHtml(armor.id)}"
                        >
                            Unequip
                        </button>
                    `}
                </div>
            </li>
        `)
        : `<li class="hud-empty-row">No equipped armor</li>`;

    // Pre-attack maneuvers, selectable here so the Attack tab is "what to do
    // this turn": pick a weapon, pick pre maneuvers, attack.
    const preManeuverRows = (data.maneuvers ?? []).length
        ? buildTreeList(data.maneuvers, (m) => `
            <li class="hud-tree-item" title="${escapeHtml(m.tooltip || m.name)}">
                <button
                    type="button"
                    class="hud-action-row${m.selected ? " is-active" : ""}${(m.source?.CostType === "CorePoints") ? " is-core-cost" : ""}"
                    data-hud-maneuver-select="${escapeHtml(m.id)}"
                    data-hud-maneuver-timing="${escapeHtml(m.timingKey)}"
                    ${m.disabled ? " disabled" : ""}
                >
                    <span class="hud-row-main">${escapeHtml(m.name)}</span>
                    <span class="hud-tree-value">${escapeHtml(m.selected ? "Selected" : (m.costSummary || ""))}</span>
                </button>
            </li>
        `)
        : `<li class="hud-empty-row">No pre maneuvers</li>`;

    return `
        <div class="hud-two-col">
            <div class="hud-tree-block">
                <div class="hud-section-title">Equipped Weapons</div>
                <ul class="hud-list hud-tree-list">${equippedWeaponRows}</ul>
            </div>
            <div class="hud-tree-block">
                <div class="hud-section-title">Equipped Armor</div>
                <ul class="hud-list hud-tree-list">${equippedArmorRows}</ul>
            </div>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Pre Maneuvers</div>
            <ul class="hud-list hud-tree-list hud-two-col">${preManeuverRows}</ul>
        </div>
    `;
}

function buildInventoryTree(data, deps = {}) {
    const { HUD_STATE, getInventoryFilterOptions, normalizeInventoryFilterValue, matchesInventoryFilter, escapeHtml } = deps;
    const filterOptions = getInventoryFilterOptions();
    const activeFilter = filterOptions.some((option) => option.normalizedValue === normalizeInventoryFilterValue(HUD_STATE.inventoryFilter))
        ? HUD_STATE.inventoryFilter
        : "all";
    const filteredItems = data.inventory.filter((item) => matchesInventoryFilter(item, activeFilter));
    const inventoryGroups = groupEntries(filteredItems, (item) => item.group || "Other Gear");

    const filterControl = `
        <div class="hud-tree-block hud-inventory-filter-bar">
            <label class="hud-counter-roll-config">
                <span>Filter</span>
                <select data-hud-inventory-filter>
                    ${filterOptions.map((option) => `
                        <option value="${escapeHtml(option.value)}"${option.value === activeFilter ? " selected" : ""}>${escapeHtml(option.label)}</option>
                    `).join("")}
                </select>
            </label>
        </div>
    `;

    const inventoryRows = buildGroupedTree(inventoryGroups, (item) => {
        const status = [item.type, item.consumable ? "Usable" : ""].filter(Boolean);
        const equipButton = item.itemKind === "weapon" || item.itemKind === "armor"
            ? `
                <div class="hud-weapon-action-strip">
                    <button
                        type="button"
                        class="hud-mini-button"
                        data-hud-item-equip="${escapeHtml(item.id)}"
                    >
                        Equip
                    </button>
                </div>
            `
            : "";

        return `
            <li class="hud-tree-item" title="${escapeHtml(item.tooltip || item.name)}">
                <div class="hud-row-main">${escapeHtml(item.name)}</div>
                ${status.length ? `<ul class="hud-tree-children"><li>${escapeHtml(status.join(" - "))}</li></ul>` : ""}
                ${equipButton}
            </li>
        `;
    }, deps, { scroll: true });

    const equippedRows = (data.equippedInventory ?? []).length
        ? buildTreeList(data.equippedInventory, (item) => {
            const status = [item.type, item.consumable ? "Usable" : ""].filter(Boolean);
            return `
                <li class="hud-tree-item" title="${escapeHtml(item.tooltip || item.name)}">
                    <div class="hud-row-main">${escapeHtml(item.name)}</div>
                    ${status.length ? `<ul class="hud-tree-children"><li>${escapeHtml(status.join(" - "))}</li></ul>` : ""}
                    ${item.isVirtualDefault ? "" : `
                        <div class="hud-weapon-action-strip">
                            <button type="button" class="hud-mini-button" data-hud-item-unequip="${escapeHtml(item.id)}">Unequip</button>
                        </div>
                    `}
                </li>
            `;
        })
        : `<li class="hud-empty-row">No equipped items</li>`;

    return `
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped</div>
            <ul class="hud-list hud-tree-list">${equippedRows}</ul>
        </div>
        ${filterControl}
        <div class="hud-tree-block">
            <div class="hud-section-title">Inventory</div>
            <div class="hud-group-stack">${inventoryRows}</div>
        </div>
    `;
}

function buildConditionTree(data, deps = {}) {
    const { escapeHtml } = deps;
    return buildTreeList(data.conditions, (condition) => {
        const desc = getConditionDescription(condition);
        return `
        <li class="hud-tree-item"${desc ? ` title="${escapeHtml(`${condition} — ${desc}`)}"` : ""}>
            <div class="hud-row-main">${escapeHtml(condition)}</div>
            ${desc ? `<div class="hud-row-sub">${escapeHtml(desc)}</div>` : ""}
        </li>
    `;
    });
}

function buildOverviewTree(data, deps = {}) {
    const { escapeHtml, formatCurrentMax } = deps;

    const hpDisplay = formatCurrentMax(data.hitPoints, data.maxHitPoints);
    const riskRows = data.riskAndCritical.map((resource) => `
        <li><span class="hud-tree-key">${escapeHtml(resource.label)}</span><span class="hud-tree-value">${escapeHtml(resource.display)}</span></li>
    `).join("");
    // Combined Advantage block: attack and skill/stat advantage on one block.
    // Each non-zero entry shows once, prefixed by Attack: or Skill: so the
    // single line can be scanned without two headers.
    const advantageEntries = [
        ...[
            { label: "Advantage", value: Number(data.weaponRollContext?.advantageDice ?? 0) || 0 },
            { label: "Risk", value: Number(data.weaponRollContext?.riskDice ?? 0) || 0 },
            { label: "Main Dice", value: Number(data.weaponRollContext?.addMainDice ?? 0) || 0 },
            { label: "Multiplier", value: Number(data.weaponRollContext?.addMultiplierDice ?? 0) || 0 },
            ...Object.entries(data.weaponRollContext?.extraDiceCounts ?? {}).map(([dieKey, count]) => ({
                label: `${dieKey}`,
                value: Number(count ?? 0) || 0,
            })),
        ].map((e) => ({ ...e, prefix: "Attack" })),
        ...[
            { label: "Base Advantage", value: Number(data.rollContext?.advantageDice ?? 0) || 0 },
            { label: "Staged d6", value: Number(data.rollContext?.extraD6 ?? 0) || 0 },
        ].map((e) => ({ ...e, prefix: "Skill" })),
    ].filter((entry) => entry.value > 0);
    const advantageRows = advantageEntries.map((entry) => `
        <li><span class="hud-tree-key">${escapeHtml(`${entry.prefix}: ${entry.label}`)}</span><span class="hud-tree-value">+${escapeHtml(entry.value)}</span></li>
    `).join("");
    const liveRiskCritRows = [
        { label: "Attack Risk Dice", value: Number(data.weaponRollContext?.riskDice ?? 0) || 0 },
        ...data.riskAndCritical.map((resource) => ({
            label: resource.label === "RISK" ? "Risk Points" : "Critical Points",
            value: resource.display,
            isDisplay: true,
        })),
    ].map((entry) => `
        <li><span class="hud-tree-key">${escapeHtml(entry.label)}</span><span class="hud-tree-value">${entry.isDisplay ? escapeHtml(entry.value) : `+${escapeHtml(entry.value)}`}</span></li>
    `).join("");
    const activeEffectRows = (data.activePersistentEffects ?? []).map((effect) => `<li><span class="hud-tree-key">${escapeHtml(effect.label)}</span><span class="hud-tree-value">${escapeHtml(effect.duration || "Active")}</span></li>`).join("");

    return `
        <div class="hud-overview-grid">
            <div class="hud-tree-block hud-overview-block hud-overview-block-hp">
                <div class="hud-section-title">Hit Points</div>
                <div class="hud-overview-value">${escapeHtml(hpDisplay || "-")}</div>
            </div>
            <div class="hud-tree-block hud-overview-block hud-overview-block-risk">
                <div class="hud-section-title">Risk & Critical</div>
                <ul class="hud-tree-children hud-tree-compact">${liveRiskCritRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
            <div class="hud-tree-block hud-overview-block">
                <div class="hud-section-title">Advantage</div>
                <ul class="hud-tree-children hud-tree-compact">${advantageRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Active Effects</div>
            <ul class="hud-tree-children hud-tree-compact">${activeEffectRows || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
    `;
}

function buildCombatStateStrip(data, deps = {}) {
    const { escapeHtml, formatCurrentMax } = deps;
    const hpDisplay = formatCurrentMax(data.hitPoints, data.maxHitPoints) || "-";
    const conditionSummary = (data.conditions ?? []).length ? data.conditions.join(", ") : "None";
    const items = [
        { label: "HP", value: hpDisplay },
        { label: "Moves", value: Number.isFinite(Number(data.movesThisTurn)) ? data.movesThisTurn : "-" },
        { label: "Attacks", value: Number.isFinite(Number(data.attacksRemaining)) ? data.attacksRemaining : "-" },
        { label: "Full Turn", value: String(data.fullTurnAvailable ?? "Unknown") },
        { label: "Risk", value: data.riskAndCritical?.find((entry) => entry.label === "RISK")?.display ?? "-" },
        { label: "Critical", value: data.riskAndCritical?.find((entry) => entry.label !== "RISK")?.display ?? "-" },
        { label: "Conditions", value: conditionSummary },
    ];
    return `
        <section class="hud-section hud-combat-strip">
            ${items.map((item) => `
                <div class="hud-combat-cell">
                    <div class="hud-combat-cell-label">${escapeHtml(item.label)}</div>
                    <div class="hud-combat-cell-value">${escapeHtml(item.value)}</div>
                </div>
            `).join("")}
        </section>
    `;
}

// Compact icon+tooltip summary shown under the portrait on every tab: HP,
// Core points, Moves, Conditions, Risk dice and Advantage dice. Replaces the
// wider combat strip + current-action panel.
function buildSummaryStrip(data, deps = {}) {
    const { escapeHtml } = deps;
    const corePool = (data.pointPools ?? []).find((p) => p.key === "CorePoints") ?? (data.pointPools ?? [])[0] ?? null;
    const conditions = data.conditions ?? [];
    const rc = data.weaponRollContext ?? data.rollContext ?? {};
    const moveDisplay = Number.isFinite(Number(data.movement)) ? String(data.movement)
        : (Number.isFinite(Number(data.movementBudget)) ? String(data.movementBudget) : "-");

    const cells = [
        { icon: "fa-heart", value: `${data.hitPoints ?? "-"}/${data.maxHitPoints ?? "-"}`, tip: "Hit Points (current / max)" },
        { icon: "fa-gem", value: corePool?.display ?? "-", tip: "Core Points (available / max)" },
        { icon: "fa-person-running", value: moveDisplay, tip: "Movement remaining (squares)" },
        { icon: "fa-heart-pulse", value: String(conditions.length), tip: `Conditions: ${conditions.length ? conditions.join(", ") : "none"}` },
        { icon: "fa-triangle-exclamation", value: String(Number(rc.riskDice ?? 0) || 0), tip: "Risk dice on your next roll" },
        { icon: "fa-star", value: String(Number(rc.advantageDice ?? 0) || 0), tip: "Advantage dice on your next roll" },
    ];
    return `
        <section class="hud-section hud-summary-strip">
            ${cells.map((c) => `
                <div class="hud-summary-cell" title="${escapeHtml(c.tip)}">
                    <i class="fa-solid ${c.icon}" aria-hidden="true"></i>
                    <span class="hud-summary-value">${escapeHtml(c.value)}</span>
                </div>
            `).join("")}
        </section>
    `;
}

function buildCurrentActionSummary(data, deps = {}) {
    const { escapeHtml } = deps;
    const action = data.currentAction ?? {};
    const preManeuverText = (action.preManeuverNames ?? []).length ? action.preManeuverNames.join(", ") : "None";
    const fullTurnText = action.fullTurnName || "None";
    const stagedParts = [action.stagedAttackDice, action.stagedSkillDice].filter(Boolean);
    const stagedText = stagedParts.length ? stagedParts.join(" | ") : "None";
    const targetText = action.targetName || "No target";
    const previewText = action.attackPreview || "No attack preview";
    return `
        <section class="hud-section">
            <div class="hud-tree-block hud-current-action">
                <div class="hud-section-title">Current Action</div>
                <div class="hud-current-action-grid">
                    <div class="hud-current-action-row">
                        <span class="hud-tree-key">Weapon</span>
                        <span class="hud-tree-value">${escapeHtml(action.weaponName || "None")}</span>
                    </div>
                    <div class="hud-current-action-row">
                        <span class="hud-tree-key">Profile</span>
                        <span class="hud-tree-value">${escapeHtml(action.weaponProfile || "None")}</span>
                    </div>
                    <div class="hud-current-action-row">
                        <span class="hud-tree-key">Target</span>
                        <span class="hud-tree-value">${escapeHtml(targetText)}</span>
                    </div>
                    <div class="hud-current-action-row">
                        <span class="hud-tree-key">Pre Maneuvers</span>
                        <span class="hud-tree-value">${escapeHtml(preManeuverText)}</span>
                    </div>
                    <div class="hud-current-action-row">
                        <span class="hud-tree-key">Full Turn</span>
                        <span class="hud-tree-value">${escapeHtml(fullTurnText)}</span>
                    </div>
                    <div class="hud-current-action-row">
                        <span class="hud-tree-key">Staged Dice</span>
                        <span class="hud-tree-value">${escapeHtml(stagedText)}</span>
                    </div>
                    <div class="hud-current-action-row hud-current-action-row-preview">
                        <span class="hud-tree-key">Preview</span>
                        <span class="hud-tree-value">${escapeHtml(previewText)}</span>
                    </div>
                </div>
            </div>
        </section>
    `;
}

// Skills-tab "Checks" header. Replaces the legacy counter-roll bar with a
// 4-way mode picker (Manual / Stat / Skill / General) and a per-mode
// expansion. Selection state lives in HUD_STATE.check*. The actual counter
// roll happens in maybeRollCounter (actor-hud.js) after the player clicks
// a skill — this renderer is presentational only.
function buildChecksHeader(data, deps = {}) {
    const { HUD_STATE, escapeHtml, sanitizeCounterRollDice } = deps;
    const target = data.checkTarget ?? { name: null, count: 0, stats: [], skills: [] };
    const hasTarget = (target.count ?? 0) > 0;
    const hasSingleTarget = (target.count ?? 0) === 1;
    const requestedMode = String(HUD_STATE.checkMode ?? "manual");
    // Coerce to a legal mode if the saved choice is no longer available
    // (e.g. Stat selected but the target dropped). Falls back to Manual.
    const allowed = {
        manual: true,
        stat: hasTarget,
        skill: hasSingleTarget,
        general: true,
    };
    const mode = allowed[requestedMode] ? requestedMode : "manual";

    const modes = [
        { key: "manual", label: "Nothing" },
        { key: "stat", label: "Target Stat", disabled: !hasTarget, title: hasTarget ? "" : "Requires at least one target" },
        { key: "skill", label: "Target Skill", disabled: !hasSingleTarget, title: hasSingleTarget ? "" : "Requires exactly one target" },
        { key: "general", label: "Difficulty" },
    ];
    const radioRow = modes.map((m) => `
        <label class="hud-check-radio${m.disabled ? " is-disabled" : ""}" title="${escapeHtml(m.title ?? "")}">
            <input type="radio" name="hud-check-mode" value="${m.key}"${mode === m.key ? " checked" : ""}${m.disabled ? " disabled" : ""} data-hud-check-mode="${m.key}">
            <span>${escapeHtml(m.label)}</span>
        </label>
    `).join("");

    let expansion = "";
    if (mode === "stat") {
        const currentStat = HUD_STATE.checkStatTarget && target.stats.some((s) => s.label === HUD_STATE.checkStatTarget)
            ? HUD_STATE.checkStatTarget
            : (target.stats[0]?.label ?? "");
        const statOptions = target.stats.map((s) => `
            <option value="${escapeHtml(s.label)}"${currentStat === s.label ? " selected" : ""}>${escapeHtml(s.label)}</option>
        `).join("");
        expansion = `
            <div class="hud-check-expansion">
                <label class="hud-counter-roll-config">
                    <span>${escapeHtml(target.name ?? "Target")} stat</span>
                    <select data-hud-check-stat>${statOptions}</select>
                </label>
            </div>
        `;
    } else if (mode === "skill") {
        // Hide skills whose target has no roll formula — they can't act as a
        // counter check, so showing them would just be noise.
        const checkableSkills = target.skills.filter((s) => Boolean(s.formula));
        const skillRows = checkableSkills.length
            ? checkableSkills.map((s) => `
                <label class="hud-check-skill-row">
                    <input type="radio" name="hud-check-target-skill" value="${escapeHtml(s.name)}"${HUD_STATE.checkSkillTarget === s.name ? " checked" : ""} data-hud-check-skill="${escapeHtml(s.name)}">
                    <span>${escapeHtml(s.name)}</span>
                </label>
            `).join("")
            : `<div class="hud-empty-row">Target has no checkable skills</div>`;
        expansion = `
            <div class="hud-check-expansion">
                <div class="hud-section-title">${escapeHtml(target.name ?? "Target")} skills</div>
                ${skillRows}
            </div>
        `;
    } else if (mode === "general") {
        const difficulties = [
            { key: "Trivial", dice: 1 },
            { key: "Easy", dice: 2 },
            { key: "Average", dice: 3 },
            { key: "Hard", dice: 4 },
            { key: "Rough", dice: 5 },
        ];
        const currentDiff = difficulties.some((d) => d.key === HUD_STATE.checkGeneralDifficulty)
            ? HUD_STATE.checkGeneralDifficulty
            : "Average";
        const diffOptions = difficulties.map((d) => `<option value="${d.key}"${currentDiff === d.key ? " selected" : ""}>${d.key}</option>`).join("");
        const diceValue = sanitizeCounterRollDice(HUD_STATE.checkGeneralDice ?? 3);
        expansion = `
            <div class="hud-check-expansion">
                <label class="hud-counter-roll-config">
                    <span>Difficulty</span>
                    <select data-hud-check-difficulty>${diffOptions}</select>
                </label>
                <label class="hud-counter-roll-config">
                    <span>d6</span>
                    <input type="number" min="1" max="6" value="${escapeHtml(diceValue)}" data-hud-check-general-dice>
                </label>
            </div>
        `;
    }

    return `
        <div class="hud-tree-block hud-check-bar">
            <div class="hud-section-title">Roll versus</div>
            <div class="hud-check-radio-row hud-check-radio-grid">${radioRow}</div>
            ${expansion}
        </div>
    `;
}

function buildCounterRollControls(deps = {}) {
    const { HUD_STATE, escapeHtml, sanitizeCounterRollDice } = deps;
    const checked = HUD_STATE.counterRollEnabled ? " checked" : "";
    return `
        <div class="hud-tree-block hud-counter-roll-bar">
            <label class="hud-counter-roll-toggle">
                <input type="checkbox" data-hud-counter-enabled${checked}>
                <span>Counter Roll</span>
            </label>
            <label class="hud-counter-roll-config">
                <span>Difficulty</span>
                <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value="${escapeHtml(sanitizeCounterRollDice(HUD_STATE.counterRollDice))}"
                    data-hud-counter-dice
                >
                <span>d6</span>
            </label>
        </div>
    `;
}

function buildDiceTree(data, deps = {}) {
    const { escapeHtml } = deps;
    const diceTab = data.diceTab ?? {};
    const attackRows = (diceTab.attackOptions ?? []).map((option) => `
        <li class="hud-tree-item hud-dice-row">
            <div class="hud-dice-row-main">
                <span class="hud-row-main" title="${escapeHtml(option.tooltip || "")}">${escapeHtml(option.label)}</span>
                <span class="hud-row-sub">d${escapeHtml(option.code)}</span>
            </div>
            <div class="hud-dice-row-controls">
                <button type="button" class="hud-mini-button" data-hud-dice-attack-adjust="${escapeHtml(option.key)}" data-hud-dice-delta="-1" title="${escapeHtml(option.tooltip || "")}">-</button>
                <span class="hud-dice-count" title="${escapeHtml(option.tooltip || "")}">${escapeHtml(option.selectedCount ?? 0)}</span>
                <button type="button" class="hud-mini-button" data-hud-dice-attack-adjust="${escapeHtml(option.key)}" data-hud-dice-delta="1" title="${escapeHtml(option.tooltip || "")}">+</button>
            </div>
        </li>
    `).join("");
    const attackSelectionLabel = diceTab.attackSelectionLabel || "0 dice";
    const pendingAttackLabel = diceTab.pendingAttackLabel || "0 dice";
    const skillSelectionLabel = diceTab.skillSelectionLabel || "0d6";
    const pendingSkillLabel = diceTab.pendingSkillLabel || "0d6";

    const hasAnyAttackToClear = diceTab.hasAttackSelection || diceTab.hasPendingAttackDice;
    return `
        <div class="hud-tree-block">
            <div class="hud-section-title">Attack Advantage Dice</div>
            <ul class="hud-list hud-tree-list hud-dice-grid">${attackRows || '<li class="hud-empty-row">No attack dice</li>'}</ul>
            <div class="hud-dice-preview-row"><span class="hud-tree-key">Selected</span><span class="hud-tree-value">${escapeHtml(attackSelectionLabel)}</span></div>
            <div class="hud-dice-preview-row"><span class="hud-tree-key">Next attack</span><span class="hud-tree-value">${escapeHtml(pendingAttackLabel)}</span></div>
            <div class="hud-weapon-action-strip hud-dice-action-strip">
                <button type="button" class="hud-mini-button hud-mini-button-primary" data-hud-dice-attack-roll${diceTab.hasAttackSelection ? "" : " disabled"}>Roll</button>
                <button type="button" class="hud-mini-button" data-hud-dice-attack-add${diceTab.hasAttackSelection ? "" : " disabled"}>Add</button>
                <button type="button" class="hud-mini-button" data-hud-dice-attack-clear${hasAnyAttackToClear ? "" : " disabled"}>Clear</button>
            </div>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Skill / Stat Advantage Dice</div>
            <div class="hud-d6-picker-row">
                <span class="hud-row-main" title="Standard d6 added to the next stat or skill roll.">d6</span>
                <div class="hud-dice-row-controls">
                    <button type="button" class="hud-mini-button" data-hud-dice-skill-adjust data-hud-dice-delta="-1" title="Standard d6 added to the next stat or skill roll.">-</button>
                    <span class="hud-dice-count" title="Standard d6 added to the next stat or skill roll.">${escapeHtml(diceTab.selectedSkillDice ?? 0)}</span>
                    <button type="button" class="hud-mini-button" data-hud-dice-skill-adjust data-hud-dice-delta="1" title="Standard d6 added to the next stat or skill roll.">+</button>
                </div>
            </div>
            <div class="hud-dice-preview-row"><span class="hud-tree-key">Selected</span><span class="hud-tree-value">${escapeHtml(skillSelectionLabel)}</span></div>
            <div class="hud-dice-preview-row"><span class="hud-tree-key">Next stat / skill</span><span class="hud-tree-value">${escapeHtml(pendingSkillLabel)}</span></div>
            <div class="hud-weapon-action-strip hud-dice-action-strip">
                <button type="button" class="hud-mini-button hud-mini-button-primary" data-hud-dice-skill-roll${diceTab.hasSkillSelection ? "" : " disabled"}>Roll</button>
                <button type="button" class="hud-mini-button" data-hud-dice-skill-add${diceTab.hasSkillSelection ? "" : " disabled"}>Add</button>
                <button type="button" class="hud-mini-button" data-hud-dice-skill-clear${diceTab.hasSkillSelection || diceTab.hasPendingSkillDice ? "" : " disabled"}>Clear</button>
            </div>
        </div>
    `;
}
function getCategoryDefinitions(data) {
    return [
        {
            key: "equipped",
            label: "Attack",
            count: data.equippedWeapons.length + data.equippedArmor.length + data.equippedInventory.filter((item) => item.itemKind !== "weapon" && item.itemKind !== "armor").length,
            icon: "fa-sword"
        },
        { key: "maneuvers", label: "Maneuvers", count: data.maneuverCount, icon: "fa-hand-fist" },
        { key: "skills", label: "Skills", count: data.skills.length, icon: "fa-graduation-cap" },
        { key: "inventory", label: "Inventory", count: data.inventory.length, icon: "fa-bag-shopping" },
        { key: "dice", label: "Dice", count: null, icon: "fa-dice-d20" },
        { key: "stats", label: "Stats", count: data.stats.length, icon: "fa-chart-simple" },
        { key: "supernatural-marks", label: "Powers", count: data.supernaturalMarks.length + data.monsterMagic.length, icon: "fa-sparkles" },
    ];
}

function buildCategoryContent(data, activeCategory, deps = {}) {
    const { escapeHtml, HUD_STATE, getStatPreview } = deps;
    switch (activeCategory) {
        case "overview":
            return buildOverviewTree(data, deps);
        case "stats":
            return (() => {
                const previewStat = getStatPreview(data);
                return `<ul class="hud-list hud-tree-list hud-stat-grid">
                ${buildTreeList(data.stats, (stat) => `
                    <li class="hud-tree-item${stat.label === previewStat?.label ? " is-active" : ""}">
                        <button type="button" class="hud-action-row${stat.label === previewStat?.label ? " is-active" : ""}" data-hud-stat="${escapeHtml(stat.label)}">
                            <span class="hud-row-main">${escapeHtml(stat.label)}</span>
                            <span class="hud-tree-value">${escapeHtml(stat.formula)}</span>
                        </button>
                    </li>
                `)}
            </ul>`;
            })();
        case "equipped":
            return buildEquippedTree(data, deps);
        case "supernatural-marks":
            return (() => {
                const markRows = data.supernaturalMarks.length
                    ? buildTreeList(data.supernaturalMarks, (mark) => `
                        <li class="hud-tree-item">
                            <button type="button" class="hud-action-row" data-hud-open-item="${escapeHtml(mark.id)}" title="${escapeHtml(mark.tooltip || mark.name)}">
                                <span class="hud-row-main">${escapeHtml(mark.name)}</span>
                                ${mark.description ? `<span class="hud-row-sub">${escapeHtml(mark.description)}</span>` : ""}
                                <span class="hud-tree-value">Open</span>
                            </button>
                        </li>
                    `)
                    : `<li class="hud-empty-row">No supernatural marks</li>`;
                const monsterMagicRows = data.monsterMagic.length
                    ? buildTreeList(data.monsterMagic, (magic) => `
                        <li class="hud-tree-item hud-weapon-card" title="${escapeHtml(magic.tooltip || magic.name)}">
                            <div class="hud-row-main">${escapeHtml(magic.name)}</div>
                            ${magic.description ? `<div class="hud-row-sub">${escapeHtml(magic.description)}</div>` : ""}
                            <div class="hud-weapon-action-strip">
                                <button type="button" class="hud-mini-button hud-mini-button-primary" data-hud-use-monster-magic="${escapeHtml(magic.id)}">
                                    Use
                                </button>
                            </div>
                        </li>
                    `)
                    : `<li class="hud-empty-row">No monster magic</li>`;
                // Monster magic only shows for monsters (actors that carry
                // monster-magic items); PCs see just their supernatural marks.
                const monsterMagicBlock = data.monsterMagic.length ? `
                    <div class="hud-tree-block">
                        <div class="hud-section-title">Monster Magic</div>
                        <ul class="hud-list hud-tree-list">${monsterMagicRows}</ul>
                    </div>
                ` : "";
                return `
                    <div class="hud-tree-block">
                        <div class="hud-section-title">Supernatural Marks</div>
                        <ul class="hud-list hud-tree-list">${markRows}</ul>
                    </div>
                    ${monsterMagicBlock}
                `;
            })();
        case "inventory":
            return buildInventoryTree(data, deps);
        case "maneuvers":
            return (() => {
                const reactionWindow = deps.getActiveReactionWindow ? deps.getActiveReactionWindow() : null;
                const postWindow = deps.getActivePostManeuverWindow ? deps.getActivePostManeuverWindow() : null;
                const maneuverFilterOptions = deps.getManeuverFilterOptions ? deps.getManeuverFilterOptions() : [{ value: "all", label: "All" }];
                // Contextual default: reactions when a reaction window is open,
                // criticals when the actor has critical points to spend, preparations
                // while in combat, else all. The filter follows context changes; a
                // manual pick sticks until the context next changes.
                // Default view shows all maneuvers (pre + full-turn to the fore,
                // passives in their own group); reaction/critical windows still
                // switch the filter contextually.
                const contextualFilter = reactionWindow ? "reaction"
                    : (Number(data.criticalPoints ?? 0) > 0 ? "post" : "all");
                if (HUD_STATE.maneuverFilterContext !== contextualFilter) {
                    HUD_STATE.maneuverFilter = contextualFilter;
                    HUD_STATE.maneuverFilterContext = contextualFilter;
                }
                const activeFilter = maneuverFilterOptions.some((option) => option.value === (HUD_STATE.maneuverFilter || "all"))
                    ? HUD_STATE.maneuverFilter
                    : "all";
                const reactionList = (reactionWindow?.reactionCandidates ?? []).map((candidate) => ({
                    id: candidate.id ?? candidate._id ?? candidate.name,
                    name: candidate.name ?? "Reaction",
                    timingKey: "reaction",
                    selected: false,
                    disabled: true,
                    usable: true,
                    selectable: false,
                    CostType: candidate.source?.CostType ?? candidate.CostType ?? null,
                    costSummary: candidate.costSummary ?? candidate.CostType ?? "Reaction",
                    summaryLine: candidate.summaryLine ?? candidate.effectSummary ?? "Triggered reaction",
                    detailLine: candidate.detailLine ?? "Use from the reaction prompt when triggered.",
                    tooltip: candidate.tooltip ?? "Use from the reaction prompt when triggered.",
                    reason: "Use from the reaction prompt when triggered.",
                }));
                const postList = (postWindow?.legalPostManeuvers ?? []).map((candidate) => ({
                    id: candidate.id ?? candidate._id ?? candidate.name,
                    name: candidate.name ?? "Post Maneuver",
                    timingKey: "post",
                    selected: false,
                    disabled: true,
                    usable: true,
                    selectable: false,
                    costSummary: candidate.costSummary ?? "Post",
                    summaryLine: candidate.summaryLine ?? candidate.effectSummary ?? "Post-attack maneuver",
                    detailLine: candidate.detailLine ?? "Use from the post-maneuver prompt when available.",
                    tooltip: candidate.tooltip ?? "Use from the post-maneuver prompt when available.",
                    reason: "Use from the post-maneuver prompt when available.",
                }));
                // The actor's known critical (post) maneuvers, for the "Criticals"
                // filter — minus any already surfaced by an open post window.
                const knownPost = (data.postManeuvers ?? []).filter((pm) => !postList.some((pl) => pl.id === pm.id));
                // Escape maneuvers sort FIRST and bypass the filter/usable gate (they
                // only appear while you hold the matching condition).
                const escapeList = data.escapeManeuvers ?? [];
                const allManeuvers = [...escapeList, ...(data.maneuvers ?? []), ...(data.fullTurnManeuvers ?? []), ...knownPost, ...postList, ...reactionList, ...(data.passiveManeuvers ?? [])];
                // Default behaviour hides anything not currently usable so the
                // list stays short; the "View all" checkbox below relaxes the
                // gate when the player wants the full menu (browse mode).
                const showAll = HUD_STATE?.maneuverShowAll === true;
                const filtered = allManeuvers
                    .filter((maneuver) => maneuver?.isEscape || maneuver?.isPassive || (deps.matchesManeuverFilter ? deps.matchesManeuverFilter(maneuver, activeFilter) : true))
                    .filter((maneuver) => maneuver?.isEscape || maneuver?.isPassive || showAll || maneuver?.usable === true);
                const renderManeuverRow = (maneuver) => {
                    const title = escapeHtml(maneuver.tooltip || "");
                    const subtitle = maneuver.reason || maneuver.summaryLine || maneuver.costSummary || "";
                    const detail = maneuver.detailLine || "";
                    const timingLabel = String(maneuver.timingKey ?? "maneuver").replace("-", " ");
                    // Maneuvers that spend the scarce Core Points pool get a subtle red tinge.
                    const usesCore = (maneuver.source?.CostType ?? maneuver.CostType) === "CorePoints";
                    const coreClass = usesCore ? " is-core-cost" : "";
                    const content = `
                        <span class="hud-row-main">${escapeHtml(maneuver.name)}</span>
                        <span class="hud-row-sub">${escapeHtml(subtitle)}</span>
                        ${detail ? `<span class="hud-row-sub">${escapeHtml(detail)}</span>` : ""}
                        <span class="hud-tree-value">${escapeHtml(maneuver.selected ? "Selected" : (maneuver.costSummary || timingLabel))}</span>
                    `;
                    if (maneuver.isEscape) {
                        return `
                            <li class="hud-tree-item is-escape" title="${title}">
                                <button
                                    type="button"
                                    class="hud-action-row is-escape${maneuver.usable ? "" : " is-muted"}${coreClass}"
                                    data-hud-escape-commit="${escapeHtml(maneuver.id)}"
                                    ${maneuver.usable ? "" : "disabled"}
                                >
                                    ${content}
                                </button>
                            </li>
                        `;
                    }
                    if (maneuver.selectable) {
                        return `
                            <li class="hud-tree-item" title="${title}">
                                <button
                                    type="button"
                                    class="hud-action-row${maneuver.selected ? " is-active" : ""}${coreClass}"
                                    data-hud-maneuver-select="${escapeHtml(maneuver.id)}"
                                    data-hud-maneuver-timing="${escapeHtml(maneuver.timingKey)}"
                                    ${maneuver.disabled ? " disabled" : ""}
                                >
                                    ${content}
                                </button>
                            </li>
                        `;
                    }
                    return `
                        <li class="hud-tree-item" title="${title}">
                            <div class="hud-action-row${maneuver.usable ? "" : " is-muted"}${coreClass}">
                                ${content}
                            </div>
                        </li>
                    `;
                };
                const timingMeta = {
                    escape: { label: "Escape", tone: "escape" },
                    reaction: { label: "Reaction", tone: "reaction" },
                    post: { label: "Critical", tone: "critical" },
                    "full-turn": { label: "Full Turn", tone: "full-turn" },
                    pre: { label: "Pre", tone: "pre" },
                    passive: { label: "Passive (always on)", tone: "passive" },
                };
                const grouped = groupEntries(filtered, (maneuver) => {
                    if (maneuver?.isEscape) return "escape";
                    return String(maneuver?.timingKey ?? "other").trim() || "other";
                });
                const timingOrder = ["escape", "reaction", "post", "pre", "full-turn", "passive", "other"];
                grouped.sort((a, b) => timingOrder.indexOf(a[0]) - timingOrder.indexOf(b[0]));
                const rows = grouped.length
                    ? grouped.map(([key, entries]) => {
                        const meta = timingMeta[key] ?? { label: key.replace("-", " "), tone: "generic" };
                        return `
                            <div class="hud-maneuver-group hud-maneuver-group-${escapeHtml(meta.tone)}">
                                <div class="hud-maneuver-group-header">
                                    <span class="hud-maneuver-group-title">${escapeHtml(meta.label)}</span>
                                    <span class="hud-maneuver-group-count">${escapeHtml(entries.length)}</span>
                                </div>
                                <ul class="hud-list hud-tree-list hud-two-col">
                                    ${buildTreeList(entries, renderManeuverRow)}
                                </ul>
                            </div>
                        `;
                    }).join("")
                    : "";
                const commitButton = data.selectedFullTurnManeuver
                    ? `
                        <div class="hud-tree-block">
                            <button type="button" class="hud-action-row is-active" data-hud-commit-full-turn>
                                <span class="hud-row-main">Commit Full-Turn Maneuver</span>
                                <span class="hud-row-sub">${escapeHtml(data.selectedFullTurnManeuver.name)}</span>
                                <span class="hud-row-sub">${escapeHtml(data.selectedFullTurnManeuver.summaryLine || data.selectedFullTurnManeuver.costSummary)}</span>
                                <span class="hud-tree-value">Commit</span>
                            </button>
                        </div>
                    `
                    : "";
                const workspaceBlock = data.isCombatActive ? buildCombatActionPanel(data, deps, "maneuvers") : "";
                return `
                    ${workspaceBlock}
                    <div class="hud-tree-block hud-inventory-filter-bar">
                        <label class="hud-counter-roll-config">
                            <span>Filter</span>
                            <select data-hud-maneuver-filter>
                                ${maneuverFilterOptions.map((option) => `
                                    <option value="${escapeHtml(option.value)}"${option.value === activeFilter ? " selected" : ""}>${escapeHtml(option.label)}</option>
                                `).join("")}
                            </select>
                        </label>
                        <label class="hud-counter-roll-toggle">
                            <input type="checkbox" data-hud-maneuver-show-all${showAll ? " checked" : ""}>
                            <span>View all</span>
                        </label>
                    </div>
                    <div class="hud-tree-block">
                        <div class="hud-section-title">Maneuvers</div>
                        ${rows || '<div class="hud-empty-row">No maneuvers match this filter</div>'}
                    </div>
                    ${commitButton}
                `;
            })();
        case "dice":
            return buildDiceTree(data, deps);
        case "skills":
            return `${buildChecksHeader(data, deps)}<ul class="hud-list hud-tree-list hud-list-scroll hud-skill-scroll hud-two-col">
                ${buildTreeList(data.skills, (skill) => `
                    <li class="hud-tree-item">
                        <button type="button" class="hud-action-row" data-hud-skill="${escapeHtml(skill.name)}" title="${escapeHtml(skill.tooltip || skill.name)}">
                            <span class="hud-row-main">${escapeHtml(skill.name)}</span>
                            <span class="hud-row-sub">${escapeHtml([skill.group, skill.linkedStat, `L${skill.currentLevel}`].filter(Boolean).join(" - "))}</span>
                            ${skill.formula ? `<span class="hud-tree-value">${escapeHtml(skill.formula)}</span>` : ""}
                        </button>
                    </li>
                `)}
            </ul>`;
        case "conditions":
            return `<ul class="hud-list hud-tree-list">${buildConditionTree(data, deps)}</ul>`;
        default:
            return buildStatsTree(data, deps);
    }
}

export function buildHudHtml(data, deps = {}) {
    const { HUD_STATE, escapeHtml, buildReactionPrompt, buildDamageTakenPrompt, buildPostManeuverPrompt } = deps;
    const categories = getCategoryDefinitions(data);
    const reactionPromptOpen = Boolean(deps.getActiveReactionWindow?.());
    const postPromptOpen = Boolean(deps.getActivePostManeuverWindow?.());
    const forcedCategory = (reactionPromptOpen || postPromptOpen) ? "maneuvers" : "";
    const preferredCategory = data.isCombatActive && HUD_STATE.activeCategory === "overview"
        ? "equipped"
        : HUD_STATE.activeCategory;
    const activeCategory = forcedCategory || (
        categories.some((category) => category.key === preferredCategory)
            ? preferredCategory
            : categories[0].key
    );
    const sideReadyButton = data.isCombatActive ? `
        <button
            type="button"
            class="hud-header-action"
            data-hud-side-ready
            title="Announce that your side is ready"
            aria-label="Announce that your side is ready"
        >
            <span>End Side Turn</span>
        </button>
    ` : "";
    const categoryTabs = categories.map((category) => `
        <button
            type="button"
            class="hud-category-tab${category.key === activeCategory ? " is-active" : ""}"
            data-hud-category="${escapeHtml(category.key)}"
        >
            ${category.icon ? `<i class="fa-solid ${escapeHtml(category.icon)}"></i>` : ""}<span>${escapeHtml(category.label)}</span>
            ${category.count === null ? "" : `<span class="hud-category-count">${escapeHtml(category.count)}</span>`}
        </button>
    `).join("");

    const promptHtml = `
        <div class="hud-floating-prompts">
            ${buildReactionPrompt()}
            ${buildDamageTakenPrompt()}
            ${buildPostManeuverPrompt()}
        </div>
    `;
    const combatHeaderBits = [];
    if (data.isCombatActive) combatHeaderBits.push(`Round ${escapeHtml(data.round ?? "-")}`);
    else combatHeaderBits.push("No active combat");
    if (data.activeSideLabel) combatHeaderBits.push(data.isActorOnActiveSide ? `${escapeHtml(data.activeSideLabel)} active` : `${escapeHtml(data.activeSideLabel)} active now`);
    if (data.actorSideLabel && data.actorSideLabel !== data.activeSideLabel) combatHeaderBits.push(`${escapeHtml(data.actorSideLabel)} for this actor`);
    if (forcedCategory === "maneuvers") combatHeaderBits.push(postPromptOpen ? "Critical window open" : "Reaction window open");

    return `
        ${promptHtml}
        <section class="hud-shell${HUD_STATE.collapsed ? " is-collapsed" : ""}">
            <header class="hud-header">
                <img class="hud-portrait" src="${escapeHtml(data.actorImg)}" alt="${escapeHtml(data.tokenName)}">
                <div class="hud-header-text">
                    <div class="hud-title">${escapeHtml(data.tokenName)}</div>
                    <div class="hud-subtitle">
                        ${combatHeaderBits.join(" | ")}
                    </div>
                </div>
                ${sideReadyButton}
                <button
                    type="button"
                    class="hud-collapse-button"
                    data-hud-collapse-toggle
                    title="${HUD_STATE.collapsed ? "Expand HUD" : "Collapse HUD"}"
                    aria-label="${HUD_STATE.collapsed ? "Expand HUD" : "Collapse HUD"}"
                >
                    <i class="fa-solid ${HUD_STATE.collapsed ? "fa-angles-right" : "fa-angles-left"}"></i>
                </button>
            </header>

            ${HUD_STATE.collapsed ? "" : `
            <section class="hud-section">
                <div class="hud-category-row">${categoryTabs}</div>
            </section>

            ${buildSummaryStrip(data, deps)}

            <section class="hud-section hud-tree-panel">
                ${buildCategoryContent(data, activeCategory, deps)}
            </section>
            `}
        </section>
    `;
}

export function buildEmptyHtml(message = "No token selected", deps = {}) {
    const { escapeHtml } = deps;
    return `
        <section class="hud-shell hud-empty-state">
            <div class="hud-title">1547 HUD</div>
            <div class="hud-subtitle">${escapeHtml(message)}</div>
        </section>
    `;
}
