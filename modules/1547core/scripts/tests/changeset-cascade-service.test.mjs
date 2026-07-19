import assert from "assert";

/**
 * Test suite for changeset-cascade-service.js
 *
 * Covers the bloated-wolf regressions:
 *   - computeDuplicateCascadeChildIds finds surplus cascade children
 *     (same parent ChangeSet + same canonical source) and keeps the first
 *   - resyncActorChangeSets deletes those surplus children
 *   - resyncActorChangeSets AWAITS an in-flight createItem-hook cascade
 *     instead of cascading the same ChangeSet a second time
 */

const capturedHooks = {};
if (typeof globalThis.game === "undefined") {
    globalThis.game = { modules: { get: () => ({ api: {} }) }, items: { get: () => null } };
}
if (typeof globalThis.Hooks === "undefined") {
    globalThis.Hooks = { on: (name, fn) => { capturedHooks[name] = fn; }, off: () => {} };
}

const { CHANGESET_TEMPLATE_ID, CHANGE_TEMPLATE_ID, SOURCE_FLAG_SCOPE } = await import("../lib/constants.mjs");
const { computeDuplicateCascadeChildIds, resyncActorChangeSets, registerChangeSetCascadeService } = await import("../services/changeset-cascade-service.js");

function changeSetItem(id, actor, linkageIds = []) {
    const changeDisplayer = {};
    for (const lid of linkageIds) changeDisplayer[lid] = { name: lid, id: lid, uuid: `Item.${lid}` };
    return {
        id,
        name: `ChangeSet ${id}`,
        parent: actor,
        system: { template: CHANGESET_TEMPLATE_ID, props: { ChangeDisplayer: changeDisplayer } },
        _source: { system: { props: { ChangeDisplayer: changeDisplayer } } },
        update: async () => {}
    };
}

function cascadeChild({ id, container, sourceId, name = "Child" }) {
    return {
        id,
        name,
        system: { template: CHANGE_TEMPLATE_ID, container },
        flags: sourceId ? { [SOURCE_FLAG_SCOPE]: { sourceData: { _id: sourceId } } } : {}
    };
}

function liveActor(initialItems, { createDelayMs = 0 } = {}) {
    const map = new Map(initialItems.map((i) => [i.id, i]));
    let counter = 0;
    const createCalls = [];
    const deleteCalls = [];
    const actor = {
        documentName: "Actor",
        name: "Test Actor",
        id: "actor-1",
        uuid: "Actor.actor-1",
        items: {
            get: (id) => map.get(id),
            get contents() { return Array.from(map.values()); },
            filter: (pred) => Array.from(map.values()).filter(pred),
            [Symbol.iterator]: () => map.values()
        },
        async createEmbeddedDocuments(_type, payloads) {
            createCalls.push(payloads);
            if (createDelayMs) await new Promise((r) => setTimeout(r, createDelayMs));
            const created = [];
            for (const data of payloads) {
                const id = `created-${++counter}`;
                const doc = { id, name: data.name, system: data.system, flags: data.flags, uuid: `Actor.actor-1.Item.${id}` };
                map.set(id, doc);
                created.push(doc);
            }
            return created;
        },
        async deleteEmbeddedDocuments(_type, ids) {
            deleteCalls.push(ids);
            for (const id of ids) map.delete(id);
            return ids;
        }
    };
    return { actor, createCalls, deleteCalls };
}

console.log("computeDuplicateCascadeChildIds...");

{
    // Mirrors the wolf export: two embedded copies of the same Grant Change,
    // both pointing at the same parent ChangeSet and stamped with the same
    // canonical source id.
    const { actor } = liveActor([
        cascadeChild({ id: "grant-a", container: "cs-wolf", sourceId: "RoWolfBsGnt00001", name: "Grant: Pack-Take-Down" }),
        cascadeChild({ id: "grant-b", container: "cs-wolf", sourceId: "RoWolfBsGnt00001", name: "Grant: Pack-Take-Down" }),
        cascadeChild({ id: "trait-a", container: "cs-wolf", sourceId: "RoWolfBsTrt00001", name: "Wolf (Beast) — Trait" })
    ]);
    assert.deepStrictEqual(computeDuplicateCascadeChildIds(actor), ["grant-b"]);
    console.log("  ✓ Flags the second copy of a duplicated cascade child, keeps the first");
}

{
    // Same source under DIFFERENT parent sets is legitimate (two sets may
    // each carry their own copy) — must not be flagged.
    const { actor } = liveActor([
        cascadeChild({ id: "a", container: "cs-1", sourceId: "Src01" }),
        cascadeChild({ id: "b", container: "cs-2", sourceId: "Src01" })
    ]);
    assert.deepStrictEqual(computeDuplicateCascadeChildIds(actor), []);
    console.log("  ✓ Same source under different parent ChangeSets is not a duplicate");
}

{
    // No canonical source stamp → falls back to name.
    const { actor } = liveActor([
        cascadeChild({ id: "a", container: "cs-1", name: "Grant: Maul" }),
        cascadeChild({ id: "b", container: "cs-1", name: "Grant: Maul" }),
        cascadeChild({ id: "c", container: "cs-1", name: "Grant: Pounce" })
    ]);
    assert.deepStrictEqual(computeDuplicateCascadeChildIds(actor), ["b"]);
    console.log("  ✓ Falls back to name when no sourceData stamp exists");
}

{
    // Free-floating items (no container) — e.g. granted weapons — are the
    // grant reconciler's business, not the cascade's. Never flagged here.
    const { actor } = liveActor([
        { id: "w1", name: "Claws", system: { template: CHANGE_TEMPLATE_ID } },
        { id: "w2", name: "Claws", system: { template: CHANGE_TEMPLATE_ID } }
    ]);
    assert.deepStrictEqual(computeDuplicateCascadeChildIds(actor), []);
    console.log("  ✓ Ignores items without a container back-pointer");
}

console.log("\nresyncActorChangeSets...");

{
    // Self-heal: a bloated actor loses its surplus cascade children.
    const set = changeSetItem("cs-wolf", null);
    const { actor, deleteCalls } = liveActor([
        set,
        cascadeChild({ id: "grant-a", container: "cs-wolf", sourceId: "RoWolfBsGnt00001" }),
        cascadeChild({ id: "grant-b", container: "cs-wolf", sourceId: "RoWolfBsGnt00001" })
    ]);
    set.parent = actor;
    const result = await resyncActorChangeSets(actor);
    assert.strictEqual(result.cascaded, 0, "set already has children — no cascade");
    assert.deepStrictEqual(deleteCalls, [["grant-b"]]);
    console.log("  ✓ Deletes surplus duplicate children during resync");
}

{
    // The race fix: a hook cascade is still in flight (slow
    // createEmbeddedDocuments) when resync runs. Resync must await it and
    // then see the children, NOT cascade the same set again.
    registerChangeSetCascadeService();
    assert.strictEqual(typeof capturedHooks.createItem, "function", "cascade service registers a createItem hook");

    const sourceChange = {
        id: "SrcChange01",
        name: "Grant: Pack-Take-Down",
        toObject: () => ({
            name: "Grant: Pack-Take-Down",
            system: { template: CHANGE_TEMPLATE_ID, props: {} },
            flags: { [SOURCE_FLAG_SCOPE]: { sourceData: { _id: "SrcChange01" } } }
        })
    };
    globalThis.game.items = { get: (id) => (id === "SrcChange01" ? sourceChange : null) };

    const set = changeSetItem("cs-race", null, ["SrcChange01"]);
    const seeded = liveActor([set], { createDelayMs: 30 });
    const raceActor = seeded.actor;
    set.parent = raceActor;

    // Fire the hook cascade (fire-and-forget, like Foundry does)...
    capturedHooks.createItem(set, {});
    // ...and immediately resync, while the cascade's create is still in flight.
    const { cascaded } = await resyncActorChangeSets(raceActor);

    assert.strictEqual(cascaded, 0, "resync must await the in-flight cascade, not re-cascade");
    assert.strictEqual(seeded.createCalls.length, 1, "the child Change must be created exactly once");
    const children = raceActor.items.filter((it) => String(it?.system?.container ?? "") === "cs-race");
    assert.strictEqual(children.length, 1);
    console.log("  ✓ Resync awaits an in-flight hook cascade instead of double-cascading");
}

console.log("\nAll changeset-cascade-service tests passed.");
