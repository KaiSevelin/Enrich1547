/**
 * Drive store.
 *
 * Drives (and Social-Battle "[Mood] …" lines) are a small ordered list of
 * "[Category] text" strings. Canonical storage is the CSB `DriveTable`
 * dynamicTable — object-keyed rows `{ "0": { DriveText }, "1": { … } }`, sorted
 * by numeric key, with `$deleted` tombstones for removed rows (Foundry deep-
 * merges object props, so a shorter list must tombstone the vanished indices).
 *
 * A legacy single-string `Drives` prop (newline-joined) is read as a fallback
 * for characters created before the table, and cleared on the first write so
 * the table becomes the single source of truth.
 */

const TABLE_KEY = "DriveTable";
const ROW_FIELD = "DriveText";
const LEGACY_KEY = "Drives";

function actorProps(actor) {
    return actor?.system?.props ?? {};
}

/**
 * Ordered list of drive lines. Prefers the DriveTable; falls back to the legacy
 * newline `Drives` string only when the table has no live rows (pre-migration).
 * @returns {string[]}
 */
export function getDrives(actor) {
    const table = actorProps(actor)[TABLE_KEY];
    if (table && typeof table === "object" && !Array.isArray(table)) {
        const rows = Object.entries(table)
            .filter(([, row]) => row && typeof row === "object" && !Array.isArray(row) && !row.$deleted)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([, row]) => String(row[ROW_FIELD] ?? "").trim())
            .filter(Boolean);
        if (rows.length) return rows;
    }
    const legacy = String(actorProps(actor)[LEGACY_KEY] ?? "").trim();
    return legacy ? legacy.split("\n").map((l) => l.trim()).filter(Boolean) : [];
}

/**
 * Pure: build the `actor.update` payload that stores `lines` as the DriveTable,
 * tombstones any existing rows that fall away, and clears the legacy string.
 */
export function buildSetDrivesUpdate(actor, lines) {
    const clean = (Array.isArray(lines) ? lines : [])
        .map((l) => String(l ?? "").trim())
        .filter(Boolean);
    const table = {};
    clean.forEach((line, i) => { table[String(i)] = { [ROW_FIELD]: line }; });

    // Tombstone existing keys the new list no longer covers — Foundry merges
    // object props, so absent keys would otherwise linger.
    const existing = actorProps(actor)[TABLE_KEY];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
        for (const key of Object.keys(existing)) {
            if (!(key in table)) table[key] = { $deleted: true };
        }
    }

    return {
        [`system.props.${TABLE_KEY}`]: table,
        [`system.props.${LEGACY_KEY}`]: ""
    };
}

/** Replace all drives. */
export async function setDrives(actor, lines) {
    if (typeof actor?.update !== "function") return;
    await actor.update(buildSetDrivesUpdate(actor, lines));
}

/** Append one drive line. Returns false for blank input. */
export async function addDrive(actor, line) {
    const clean = String(line ?? "").trim();
    if (!clean) return false;
    await setDrives(actor, [...getDrives(actor), clean]);
    return true;
}

/** Maximum drives a chargen character carries. */
export const CHARGEN_DRIVE_CAP = 3;

/**
 * Append one drive line under a cap: when the append would exceed `max`,
 * randomly-chosen OLD lines are removed until the list fits — the new line
 * always survives. Returns { added, removed } where `removed` lists the
 * lines that were dropped (empty when the cap wasn't hit).
 *
 * `random` is injectable for tests (defaults to Math.random).
 */
export async function addDriveCapped(actor, line, { max = CHARGEN_DRIVE_CAP, random = Math.random } = {}) {
    const clean = String(line ?? "").trim();
    if (!clean) return { added: false, removed: [] };
    const old = getDrives(actor);
    const removed = [];
    const kept = [...old];
    while (kept.length + 1 > max && kept.length > 0) {
        const idx = Math.floor(random() * kept.length);
        removed.push(kept[idx]);
        kept.splice(idx, 1);
    }
    await setDrives(actor, [...kept, clean]);
    return { added: true, removed };
}

/** Remove the drive at `index`. Returns false if out of range. */
export async function removeDriveAt(actor, index) {
    const lines = getDrives(actor);
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= lines.length) return false;
    await setDrives(actor, lines.filter((_, n) => n !== i));
    return true;
}

/** Remove every drive line matching `predicate(line)`. Returns how many went. */
export async function removeDrivesWhere(actor, predicate) {
    const lines = getDrives(actor);
    const kept = lines.filter((l) => !predicate(l));
    if (kept.length === lines.length) return 0;
    await setDrives(actor, kept);
    return lines.length - kept.length;
}
