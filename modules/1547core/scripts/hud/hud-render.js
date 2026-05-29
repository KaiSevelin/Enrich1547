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
    const statRows = data.stats.map((stat) => `<li><span class="hud-tree-key">${escapeHtml(stat.label)}</span><span class="hud-tree-value">${escapeHtml(stat.formula)}</span></li>`).join("");
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

            return `
                <li class="hud-tree-item hud-weapon-card">
                    <div class="hud-row-main">${escapeHtml(weapon.name)}</div>
                    <div class="hud-row-sub">${escapeHtml([weapon.equipped ? "Equipped" : "Carried", weapon.type, weapon.rangeSummary ? `Range ${weapon.rangeSummary}` : ""].filter(Boolean).join(" - "))}</div>
                    <div class="hud-weapon-action-strip">
                        <button
                            type="button"
                            class="hud-mini-button hud-mini-button-primary"
                            data-hud-weapon-attack="${escapeHtml(weapon.id)}"
                        >
                            Attack
                        </button>
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
                    <div class="hud-weapon-action-status ${weapon.attackState?.status === "valid" ? "is-valid" : "is-invalid"}">${escapeHtml(weapon.attackState?.label || "Unavailable")}</div>
                    <div class="hud-row-sub">${escapeHtml(weapon.attackState?.reason || "")}</div>
                    <ul class="hud-tree-children hud-tree-compact">
                        <li><span class="hud-tree-key">Active</span><span class="hud-tree-value">${escapeHtml(weapon.activeAttackFormula || "-")}</span></li>
                        ${weapon.weaponModifierSummary ? `<li><span class="hud-tree-key">Modifiers</span><span class="hud-tree-value">${escapeHtml(weapon.weaponModifierSummary)}</span></li>` : ""}
                        ${weapon.usesAmmo ? `<li><span class="hud-tree-key">Loaded Ammo</span><span class="hud-tree-value">${escapeHtml(weapon.loadedAmmoName ? `${weapon.loadedAmmoName} (${weapon.ammoLoaded})` : "None")}</span></li>` : ""}
                        ${weapon.usesAmmo && weapon.ammoModifierSummary ? `<li><span class="hud-tree-key">Ammo Mods</span><span class="hud-tree-value">${escapeHtml(weapon.ammoModifierSummary)}</span></li>` : ""}
                        ${weapon.usesAmmo && weapon.activeAttackAmmoText ? `<li><span class="hud-tree-key">Allowed Ammo</span><span class="hud-tree-value">${escapeHtml(weapon.activeAttackAmmoText)}</span></li>` : ""}
                    </ul>
                    <div class="hud-weapon-controls">
                        <div class="hud-weapon-control-group">
                            <div class="hud-weapon-control-label">Profiles</div>
                            <div class="hud-chip-row">${profileButtons}</div>
                        </div>
                        ${weapon.usesAmmo ? `
                            <div class="hud-weapon-control-group">
                                <div class="hud-weapon-control-label">Ammo</div>
                                <div class="hud-chip-row">${ammoButtons}</div>
                            </div>
                        ` : ""}
                    </div>
                </li>
            `;
        })
        : `<li class="hud-empty-row">No equipped weapons</li>`;

    const equippedArmorRows = data.equippedArmor.length
        ? buildTreeList(data.equippedArmor, (armor) => `
            <li class="hud-tree-item">
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

    const equippedItemGroups = groupEntries(
        data.equippedInventory.filter((item) => item.itemKind !== "weapon" && item.itemKind !== "armor"),
        (item) => item.group || "Other Gear"
    );
    const equippedItemRows = buildGroupedTree(equippedItemGroups, (item) => {
        const status = [item.type, item.equipped ? "Equipped" : "", item.consumable ? "Usable" : ""].filter(Boolean);
        return `
            <li class="hud-tree-item">
                <div class="hud-row-main">${escapeHtml(item.name)}</div>
                ${status.length ? `<ul class="hud-tree-children"><li>${escapeHtml(status.join(" - "))}</li></ul>` : ""}
                <div class="hud-weapon-action-strip">
                    <button
                        type="button"
                        class="hud-mini-button"
                        data-hud-item-unequip="${escapeHtml(item.id)}"
                    >
                        Unequip
                    </button>
                </div>
            </li>
        `;
    }, deps, { scroll: true });

    const monsterMagicRows = data.monsterMagic.length
        ? buildTreeList(data.monsterMagic, (magic) => `
            <li class="hud-tree-item hud-weapon-card">
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

    return `
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped Weapons</div>
            <ul class="hud-list hud-tree-list">${equippedWeaponRows}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Attacks</div>
            <ul class="hud-list hud-tree-list">${monsterMagicRows}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped Armor</div>
            <ul class="hud-list hud-tree-list">${equippedArmorRows}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped Gear</div>
            <div class="hud-group-stack">${equippedItemRows}</div>
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
            <li class="hud-tree-item">
                <div class="hud-row-main">${escapeHtml(item.name)}</div>
                ${status.length ? `<ul class="hud-tree-children"><li>${escapeHtml(status.join(" - "))}</li></ul>` : ""}
                ${equipButton}
            </li>
        `;
    }, deps, { scroll: true });

    return `
        ${filterControl}
        <div class="hud-tree-block">
            <div class="hud-section-title">Inventory</div>
            <div class="hud-group-stack">${inventoryRows}</div>
        </div>
    `;
}

function buildConditionTree(data, deps = {}) {
    const { escapeHtml } = deps;
    return buildTreeList(data.conditions, (condition) => `
        <li class="hud-tree-item">
            <div class="hud-row-main">${escapeHtml(condition)}</div>
        </li>
    `);
}

function buildOverviewTree(data, deps = {}) {
    const { escapeHtml, formatCurrentMax } = deps;
    const equippedRows = [];
    for (const weapon of data.equippedWeapons) {
        const weaponValue = [weapon.equipped ? "Equipped" : "Carried", weapon.rangeSummary ? `R ${weapon.rangeSummary}` : ""].filter(Boolean).join(" - ");
        equippedRows.push(`<li><span class="hud-tree-key">${escapeHtml(weapon.name)}</span><span class="hud-tree-value">${escapeHtml(weaponValue)}</span></li>`);
    }
    for (const armor of data.equippedArmor) {
        equippedRows.push(`<li><span class="hud-tree-key">${escapeHtml(armor.name)}</span><span class="hud-tree-value">${escapeHtml(armor.defense || "Equipped")}</span></li>`);
    }

    const statusRows = data.conditions.map((condition) => `<li><span class="hud-tree-key">${escapeHtml(condition)}</span><span class="hud-tree-value">Active</span></li>`);
    const hpDisplay = formatCurrentMax(data.hitPoints, data.maxHitPoints);
    const pointRows = data.pointPools.map((resource) => `
        <li class="hud-point-cell">
            <span class="hud-tree-key">${escapeHtml(resource.label)}</span>
            <span class="hud-tree-value">${escapeHtml(resource.display)}</span>
        </li>
    `).join("");
    const riskRows = data.riskAndCritical.map((resource) => `
        <li><span class="hud-tree-key">${escapeHtml(resource.label)}</span><span class="hud-tree-value">${escapeHtml(resource.display)}</span></li>
    `).join("");
    const attackAdvantageRows = [
        { label: "Advantage", value: Number(data.weaponRollContext?.advantageDice ?? 0) || 0 },
        { label: "Risk", value: Number(data.weaponRollContext?.riskDice ?? 0) || 0 },
        { label: "Main Dice", value: Number(data.weaponRollContext?.addMainDice ?? 0) || 0 },
        { label: "Multiplier", value: Number(data.weaponRollContext?.addMultiplierDice ?? 0) || 0 },
        ...Object.entries(data.weaponRollContext?.extraDiceCounts ?? {}).map(([dieKey, count]) => ({
            label: `${dieKey}`,
            value: Number(count ?? 0) || 0,
        })),
    ].filter((entry) => entry.value > 0).map((entry) => `
        <li><span class="hud-tree-key">${escapeHtml(entry.label)}</span><span class="hud-tree-value">+${escapeHtml(entry.value)}</span></li>
    `).join("");
    const skillAdvantageRows = [
        { label: "Base Advantage", value: Number(data.rollContext?.advantageDice ?? 0) || 0 },
        { label: "Staged d6", value: Number(data.rollContext?.extraD6 ?? 0) || 0 },
    ].filter((entry) => entry.value > 0).map((entry) => `
        <li><span class="hud-tree-key">${escapeHtml(entry.label)}</span><span class="hud-tree-value">+${escapeHtml(entry.value)}</span></li>
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
    const rangedWeapons = data.equippedWeapons.filter((weapon) => weapon.rangeSummary);
    const activeEffectRows = (data.activePersistentEffects ?? []).map((effect) => `<li><span class="hud-tree-key">${escapeHtml(effect.label)}</span><span class="hud-tree-value">${escapeHtml(effect.duration || "Active")}</span></li>`).join("");
    const rangeLegend = rangedWeapons.length ? `
        <div class="hud-tree-block">
            <div class="hud-section-title">Range Bands</div>
            <div class="hud-pill-row">
                <span class="hud-pill"><span class="hud-pill-label">Short</span><span class="hud-pill-value">Normal</span></span>
                <span class="hud-pill"><span class="hud-pill-label">Long</span><span class="hud-pill-value">Disadvantage</span></span>
                <span class="hud-pill"><span class="hud-pill-label">Max</span><span class="hud-pill-value">Maneuvers</span></span>
            </div>
            <ul class="hud-tree-children hud-tree-compact">
                ${rangedWeapons.map((weapon) => `<li><span class="hud-tree-key">${escapeHtml(weapon.name)}</span><span class="hud-tree-value">${escapeHtml(weapon.rangeSummary)}</span></li>`).join("")}
            </ul>
        </div>
    ` : "";

    return `
        <div class="hud-overview-grid">
            <div class="hud-tree-block hud-overview-block hud-overview-block-hp">
                <div class="hud-section-title">Hit Points</div>
                <div class="hud-overview-value">${escapeHtml(hpDisplay || "-")}</div>
            </div>
            <div class="hud-tree-block hud-overview-block">
                <div class="hud-section-title">Point Pools</div>
                <ul class="hud-tree-children hud-tree-compact hud-points-grid">${pointRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
            <div class="hud-tree-block hud-overview-block hud-overview-block-risk">
                <div class="hud-section-title">Risk & Critical</div>
                <ul class="hud-tree-children hud-tree-compact">${liveRiskCritRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
            <div class="hud-tree-block hud-overview-block">
                <div class="hud-section-title">Attack Advantage Dice</div>
                <ul class="hud-tree-children hud-tree-compact">${attackAdvantageRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
            <div class="hud-tree-block hud-overview-block">
                <div class="hud-section-title">Skill / Stat Advantage Dice</div>
                <ul class="hud-tree-children hud-tree-compact">${skillAdvantageRows || '<li class="hud-empty-row">None</li>'}</ul>
            </div>
        </div>
        ${rangeLegend}
        <div class="hud-tree-block">
            <div class="hud-section-title">Active Effects</div>
            <ul class="hud-tree-children hud-tree-compact">${activeEffectRows || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Equipped</div>
            <ul class="hud-tree-children hud-tree-compact">${equippedRows.join("") || '<li class="hud-empty-row">None</li>'}</ul>
        </div>
        <div class="hud-tree-block">
            <div class="hud-section-title">Status</div>
            <ul class="hud-tree-children hud-tree-compact">${statusRows.join("") || '<li class="hud-empty-row">None</li>'}</ul>
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

    return `
        <div class="hud-tree-block">
            <div class="hud-section-title">Attack Advantage Dice</div>
            <ul class="hud-list hud-tree-list">${attackRows || '<li class="hud-empty-row">No attack dice</li>'}</ul>
            <div class="hud-dice-preview-row"><span class="hud-tree-key">Selected</span><span class="hud-tree-value">${escapeHtml(attackSelectionLabel)}</span></div>
            <div class="hud-dice-preview-row"><span class="hud-tree-key">Next attack</span><span class="hud-tree-value">${escapeHtml(pendingAttackLabel)}</span></div>
            <div class="hud-weapon-action-strip hud-dice-action-strip">
                <button type="button" class="hud-mini-button hud-mini-button-primary" data-hud-dice-attack-roll${diceTab.hasAttackSelection ? "" : " disabled"}>Roll</button>
                <button type="button" class="hud-mini-button" data-hud-dice-attack-add${diceTab.hasAttackSelection ? "" : " disabled"}>Add</button>
                <button type="button" class="hud-mini-button" data-hud-dice-attack-clear${diceTab.hasPendingAttackDice ? "" : " disabled"}>Clear</button>
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
                <button type="button" class="hud-mini-button" data-hud-dice-skill-clear${diceTab.hasPendingSkillDice ? "" : " disabled"}>Clear</button>
            </div>
        </div>
    `;
}
function getCategoryDefinitions(data) {
    return [
        { key: "dice", label: "Dice", count: null, icon: "fa-dice-d20" },
        { key: "overview", label: "Overview", count: null },
        { key: "stats", label: "Stats", count: data.stats.length },
        { key: "supernatural-marks", label: "Marks", count: data.supernaturalMarks.length, icon: "fa-sparkles" },
        {
            key: "equipped",
            label: "Equipped",
            count: data.equippedWeapons.length + data.monsterMagic.length + data.equippedArmor.length + data.equippedInventory.filter((item) => item.itemKind !== "weapon" && item.itemKind !== "armor").length
        },
        { key: "inventory", label: "Inventory", count: data.inventory.length },
        { key: "maneuvers", label: "Maneuvers", count: data.maneuverCount },
        { key: "skills", label: "Skills", count: data.skills.length },
        { key: "conditions", label: "Conditions", count: data.conditions.length }
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
                return `${buildCounterRollControls(deps)}<ul class="hud-list hud-tree-list hud-stat-grid">
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
            return `<ul class="hud-list hud-tree-list hud-list-scroll hud-single-scroll">
                ${buildTreeList(data.supernaturalMarks, (mark) => `
                    <li class="hud-tree-item">
                        <button type="button" class="hud-action-row" data-hud-open-item="${escapeHtml(mark.id)}">
                            <span class="hud-row-main">${escapeHtml(mark.name)}</span>
                            ${mark.description ? `<span class="hud-row-sub">${escapeHtml(mark.description)}</span>` : ""}
                            <span class="hud-tree-value">Open</span>
                        </button>
                    </li>
                `)}
            </ul>`;
        case "inventory":
            return buildInventoryTree(data, deps);
        case "maneuvers":
            return (() => {
                const reactionWindow = deps.getActiveReactionWindow ? deps.getActiveReactionWindow() : null;
                const postWindow = deps.getActivePostManeuverWindow ? deps.getActivePostManeuverWindow() : null;
                const maneuverFilterOptions = deps.getManeuverFilterOptions ? deps.getManeuverFilterOptions() : [{ value: "all", label: "All" }];
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
                const allManeuvers = [...(data.maneuvers ?? []), ...(data.fullTurnManeuvers ?? []), ...postList, ...reactionList];
                const filtered = allManeuvers.filter((maneuver) => deps.matchesManeuverFilter ? deps.matchesManeuverFilter(maneuver, activeFilter) : true);
                const rows = buildTreeList(filtered, (maneuver) => {
                    const title = escapeHtml(maneuver.tooltip || "");
                    const subtitle = maneuver.reason || maneuver.summaryLine || maneuver.costSummary || "";
                    const detail = maneuver.detailLine || "";
                    const timingLabel = String(maneuver.timingKey ?? "maneuver").replace("-", " ");
                    const content = `
                        <span class="hud-row-main">${escapeHtml(maneuver.name)}</span>
                        <span class="hud-row-sub">${escapeHtml(subtitle)}</span>
                        ${detail ? `<span class="hud-row-sub">${escapeHtml(detail)}</span>` : ""}
                        <span class="hud-tree-value">${escapeHtml(maneuver.selected ? "Selected" : (maneuver.costSummary || timingLabel))}</span>
                    `;
                    if (maneuver.selectable) {
                        return `
                            <li class="hud-tree-item" title="${title}">
                                <button
                                    type="button"
                                    class="hud-action-row${maneuver.selected ? " is-active" : ""}"
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
                            <div class="hud-action-row${maneuver.usable ? "" : " is-muted"}">
                                ${content}
                            </div>
                        </li>
                    `;
                });
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
                return `
                    <div class="hud-tree-block hud-inventory-filter-bar">
                        <label class="hud-counter-roll-config">
                            <span>Filter</span>
                            <select data-hud-maneuver-filter>
                                ${maneuverFilterOptions.map((option) => `
                                    <option value="${escapeHtml(option.value)}"${option.value === activeFilter ? " selected" : ""}>${escapeHtml(option.label)}</option>
                                `).join("")}
                            </select>
                        </label>
                    </div>
                    <div class="hud-tree-block">
                        <div class="hud-section-title">Maneuvers</div>
                        <ul class="hud-list hud-tree-list">
                            ${rows || '<li class="hud-empty-row">No maneuvers match this filter</li>'}
                        </ul>
                    </div>
                    ${commitButton}
                `;
            })();
        case "dice":
            return buildDiceTree(data, deps);
        case "skills":
            return `${buildCounterRollControls(deps)}<ul class="hud-list hud-tree-list hud-list-scroll hud-single-scroll">
                ${buildTreeList(data.skills, (skill) => `
                    <li class="hud-tree-item">
                        <button type="button" class="hud-action-row" data-hud-skill="${escapeHtml(skill.name)}">
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
    const activeCategory = categories.some((category) => category.key === HUD_STATE.activeCategory)
        ? HUD_STATE.activeCategory
        : categories[0].key;
    const sideReadyButton = data.isCombatActive ? `
        <button
            type="button"
            class="hud-category-tab"
            data-hud-side-ready
            title="Announce that your side is ready"
            aria-label="Announce that your side is ready"
        >
            <span>Side Ready</span>
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

    return `
        ${promptHtml}
        <section class="hud-shell${HUD_STATE.collapsed ? " is-collapsed" : ""}">
            <header class="hud-header">
                <img class="hud-portrait" src="${escapeHtml(data.actorImg)}" alt="${escapeHtml(data.tokenName)}">
                <div class="hud-header-text">
                    <div class="hud-title">${escapeHtml(data.tokenName)}</div>
                    <div class="hud-subtitle">
                        ${data.isCombatActive ? `Combat round ${escapeHtml(data.round ?? "-")}` : "No active combat"}
                    </div>
                </div>
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
                <div class="hud-category-row">${sideReadyButton}${categoryTabs}</div>
            </section>

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




