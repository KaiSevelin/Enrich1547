// Pure chargen schema-validation core, extracted from chargen.js. Operates on
// already-parsed plain objects (no Foundry docs), so it is unit-testable with
// literal fixtures. SkillTreeChargenApp keeps thin static delegators to these.

import { PRIMARY_STATS } from "../../foundry/Templates/chargen/foundry-primary-stats/stats.js";
import { normalizeTableKey } from "./chargen-utils.js";

const UNKNOWN_EXTREME_EXCLUDED_TABLE_REFS = new Set([
    "RollTable.BhHorosc3d6Q7mR4",
    "RollTable.BhHumors1d8Q7mRX",
    "birth-horoscope",
    "birth-humors"
]);

export const VALID_STATS = new Set(PRIMARY_STATS.map(String));

export const CHANGE_TYPES = new Set([
    "stat",
    "skill",
    "maneuver",
    "money",
    "luck",
    "contact",
    "body",
    "social",
    "drive",
    "bio",
    "item",
    "language",
    "move"
]);

export function _isObject(v) {
    return v && typeof v === "object" && !Array.isArray(v);
}

export function _tableUsesUnknownExtremeReveal(table) {
    if (!table) return false;

    const refs = [
        String(table.uuid ?? "").trim(),
        String(table.id ?? "").trim(),
        normalizeTableKey(table.name)
    ].filter(Boolean);

    return !refs.some(ref => UNKNOWN_EXTREME_EXCLUDED_TABLE_REFS.has(ref));
}

export function _resultHasExtremeUnknownReveal(result) {
    const range = Array.isArray(result?.range) ? result.range : [];
    if (range.length < 2) return false;

    const [min, max] = range.map(v => Number(v));
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;

    return (min <= 3 && max >= 3) || (min <= 18 && max >= 18);
}

export function _isFiniteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n);
}

export function _requireString(v, msg) {
    if (typeof v !== "string" || !v.trim()) {
        throw new Error(msg);
    }
}

export function _requireFiniteNumber(v, msg) {
    if (!_isFiniteNumber(v)) {
        throw new Error(msg);
    }
}

export function _validateChangeSchema(ch, tableName, rewardIdx, changeIdx) {
    if (!_isObject(ch)) {
        throw new Error(`rewards[${rewardIdx}].changes[${changeIdx}] must be an object in "${tableName}".`);
    }

    const type = String(ch.type ?? "").trim();
    if (!CHANGE_TYPES.has(type)) {
        throw new Error(`Unknown change type "${type}" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
    }

    if (type === "stat") {
        _requireString(
            ch.characteristic,
            `Stat change requires "characteristic" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
        );
        if (!VALID_STATS.has(String(ch.characteristic).trim())) {
            throw new Error(`Invalid stat "${ch.characteristic}" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
        _requireFiniteNumber(
            ch.steps,
            `Stat change requires numeric "steps" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
        );
        return;
    }

    if (type === "skill" || type === "maneuver") {
        const targetKey = String(ch.targetKey ?? ch.skill ?? ch.maneuver ?? "").trim();
        if (!targetKey) {
            throw new Error(
                `${type === "maneuver" ? "Maneuver" : "Skill"} change requires "targetKey" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
            );
        }
        if (ch.targetLevel != null) {
            _requireFiniteNumber(
                ch.targetLevel,
                `${type === "maneuver" ? "Maneuver" : "Skill"} change "targetLevel" must be numeric in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
            );
        }
        return;
    }

    if (type === "money") {
        const hasAmount = ch.amount != null;
        const hasFormula = ch.formula != null && String(ch.formula).trim() !== "";
        if (!hasAmount && !hasFormula) {
            throw new Error(`Money change requires "amount" or "formula" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
        if (hasAmount) {
            _requireFiniteNumber(
                ch.amount,
                `Money change "amount" must be numeric in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
            );
        }
        if (hasFormula) {
            _requireString(
                ch.formula,
                `Money change "formula" must be a string in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
            );
        }
        return;
    }

    if (type === "luck") {
        if (typeof ch.on !== "boolean") {
            throw new Error(`Luck change requires boolean "on" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
        return;
    }

    if (type === "contact") {
        if (ch.text != null && typeof ch.text !== "string") {
            throw new Error(`Contact change "text" must be a string in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
        return;
    }

    if (type === "body") {
        return;
    }

    if (type === "social") {
        _requireFiniteNumber(
            ch.amount,
            `Social change requires numeric "amount" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
        );
        return;
    }

    if (type === "move") {
        _requireFiniteNumber(
            ch.amount,
            `Move change requires numeric "amount" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
        );
        if (ch.moveType != null && typeof ch.moveType !== "string") {
            throw new Error(`Move change "moveType" must be a string in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
        return;
    }

    if (type === "drive") {
        const action = String(ch.action ?? "").trim();
        if (action !== "add" && action !== "remove") {
            throw new Error(`Drive change requires "action" of "add" or "remove" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
        if (action === "add") {
            _requireString(
                ch.category,
                `Drive change with action "add" requires "category" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
            );
        }
        return;
    }

    if (type === "bio") {
        const hasText = ch.text != null && String(ch.text).trim() !== "";
        const hasRoll = _isObject(ch.roll) && String(ch.roll.tableUuid ?? "").trim() !== "";
        if (!hasText && !hasRoll) {
            throw new Error(`Bio change requires "text" and/or "roll.tableUuid" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
        return;
    }

    if (type === "item") {
        const hasItemUuid = ch.itemUuid != null && String(ch.itemUuid).trim() !== "";
        const hasName = ch.name != null && String(ch.name).trim() !== "";
        const hasTableUuid = ch.tableUuid != null && String(ch.tableUuid).trim() !== "";

        if (!hasItemUuid && !hasName && !hasTableUuid) {
            throw new Error(`Item change requires one of "itemUuid", "name", or "tableUuid" in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }

        if (ch.qty != null) {
            _requireFiniteNumber(
                ch.qty,
                `Item change "qty" must be numeric in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`
            );
        }
        return;
    }

    if (type === "language") {
        if (ch.tableKey != null && typeof ch.tableKey !== "string") {
            throw new Error(`Language change "tableKey" must be a string in "${tableName}" (rewards[${rewardIdx}].changes[${changeIdx}]).`);
        }
    }
}

export function _validateParsedResultSchema(parsed, tableName) {
    if (!_isObject(parsed)) {
        throw new Error(`Parsed result must be an object in "${tableName}".`);
    }

    if (!_isObject(parsed.choice)) {
        throw new Error(`Missing "choice" object in "${tableName}".`);
    }

    _requireString(parsed.choice.title, `Missing choice.title in "${tableName}".`);
    if (parsed.choice.text != null && typeof parsed.choice.text !== "string") {
        throw new Error(`choice.text must be a string in "${tableName}".`);
    }
    if (parsed.choice.icon != null && typeof parsed.choice.icon !== "string") {
        throw new Error(`choice.icon must be a string in "${tableName}".`);
    }
    if (parsed.choice.tags != null && !Array.isArray(parsed.choice.tags)) {
        throw new Error(`choice.tags must be an array in "${tableName}".`);
    }

    if (parsed.bio != null && typeof parsed.bio !== "string") {
        throw new Error(`bio must be a string in "${tableName}".`);
    }

    if (parsed.deferred != null) {
        if (!_isObject(parsed.deferred)) {
            throw new Error(`deferred must be an object in "${tableName}".`);
        }
        _requireString(parsed.deferred.type, `deferred.type must be a non-empty string in "${tableName}".`);
        if (parsed.deferred.origin != null && typeof parsed.deferred.origin !== "string") {
            throw new Error(`deferred.origin must be a string in "${tableName}".`);
        }
        if (parsed.deferred.delay != null && typeof parsed.deferred.delay !== "string") {
            throw new Error(`deferred.delay must be a string in "${tableName}".`);
        }
        if (parsed.deferred.image != null && typeof parsed.deferred.image !== "string") {
            throw new Error(`deferred.image must be a string in "${tableName}".`);
        }
        if (parsed.deferred.stage != null && !_isFiniteNumber(parsed.deferred.stage)) {
            throw new Error(`deferred.stage must be numeric in "${tableName}".`);
        }
    }

    const hasRewards = Array.isArray(parsed.rewards) && parsed.rewards.length > 0;
    const hasEffectTables = Array.isArray(parsed.effectTables) && parsed.effectTables.length > 0;
    if (!hasRewards && !hasEffectTables) {
        throw new Error(`Missing rewards[] or effectTables[] in "${tableName}".`);
    }

    if (hasRewards) {
        parsed.rewards.forEach((rw, rewardIdx) => {
            if (!_isObject(rw)) {
                throw new Error(`rewards[${rewardIdx}] must be an object in "${tableName}".`);
            }

            if (!Array.isArray(rw.changes)) {
                throw new Error(`rewards[${rewardIdx}].changes must be an array in "${tableName}".`);
            }

            if (rw.weight != null && !_isFiniteNumber(rw.weight)) {
                throw new Error(`rewards[${rewardIdx}].weight must be numeric in "${tableName}".`);
            }

            if (rw.next != null) {
                if (!_isObject(rw.next)) {
                    throw new Error(`rewards[${rewardIdx}].next must be an object in "${tableName}".`);
                }
                _requireString(
                    rw.next.tableUuid,
                    `rewards[${rewardIdx}].next.tableUuid must be a non-empty string in "${tableName}".`
                );
            }
            if (rw.transitionMode != null && String(rw.transitionMode).trim() !== "") {
                const mode = String(rw.transitionMode).trim().toLowerCase();
                if (mode !== "forced" && mode !== "optional") {
                    throw new Error(`rewards[${rewardIdx}].transitionMode must be "forced" or "optional" in "${tableName}".`);
                }
            }
            if (rw.transitionPrompt != null && typeof rw.transitionPrompt !== "string") {
                throw new Error(`rewards[${rewardIdx}].transitionPrompt must be a string in "${tableName}".`);
            }

            rw.changes.forEach((ch, changeIdx) => {
                _validateChangeSchema(ch, tableName, rewardIdx, changeIdx);
            });
        });
    }

    if (hasEffectTables) {
        parsed.effectTables.forEach((tbl, tableIdx) => {
            if (!_isObject(tbl)) {
                throw new Error(`effectTables[${tableIdx}] must be an object in "${tableName}".`);
            }
            if (!Array.isArray(tbl.rows) || tbl.rows.length === 0) {
                throw new Error(`effectTables[${tableIdx}].rows must be a non-empty array in "${tableName}".`);
            }
            tbl.rows.forEach((row, rowIdx) => {
                if (!_isObject(row)) {
                    throw new Error(`effectTables[${tableIdx}].rows[${rowIdx}] must be an object in "${tableName}".`);
                }
                _requireFiniteNumber(
                    row.weight,
                    `effectTables[${tableIdx}].rows[${rowIdx}].weight must be numeric in "${tableName}".`
                );
                if (row.transitionText != null && typeof row.transitionText !== "string") {
                    throw new Error(`effectTables[${tableIdx}].rows[${rowIdx}].transitionText must be a string in "${tableName}".`);
                }
                if (row.transitionMode != null && String(row.transitionMode).trim() !== "") {
                    const mode = String(row.transitionMode).trim().toLowerCase();
                    if (mode !== "forced" && mode !== "optional") {
                        throw new Error(`effectTables[${tableIdx}].rows[${rowIdx}].transitionMode must be "forced" or "optional" in "${tableName}".`);
                    }
                }
                if (row.transitionPrompt != null && typeof row.transitionPrompt !== "string") {
                    throw new Error(`effectTables[${tableIdx}].rows[${rowIdx}].transitionPrompt must be a string in "${tableName}".`);
                }
                if (row.next != null) {
                    if (!_isObject(row.next)) {
                        throw new Error(`effectTables[${tableIdx}].rows[${rowIdx}].next must be an object in "${tableName}".`);
                    }
                    _requireString(
                        row.next.tableUuid,
                        `effectTables[${tableIdx}].rows[${rowIdx}].next.tableUuid must be a non-empty string in "${tableName}".`
                    );
                }
                if (row.change != null) {
                    _validateChangeSchema(
                        row.change,
                        tableName,
                        tableIdx,
                        rowIdx
                    );
                }
            });
        });
    }
}

export function _sourceLabel({ rewardIdx = null, changeIdx = null, tableIdx = null, rowIdx = null } = {}) {
    if (tableIdx != null && rowIdx != null) return `effectTables[${tableIdx}].rows[${rowIdx}]`;
    if (rewardIdx != null && changeIdx != null) return `rewards[${rewardIdx}].changes[${changeIdx}]`;
    if (rewardIdx != null) return `rewards[${rewardIdx}]`;
    return "result";
}

