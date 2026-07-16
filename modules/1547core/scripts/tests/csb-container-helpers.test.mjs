import assert from "assert";

/**
 * Test suite for csb-container-helpers.mjs
 *
 * These guard the regression that broke the whole monster-wizard pipeline:
 * CSB's data-prep RECOMPUTES itemContainer linkage props (ChangeDisplayer,
 * ItemGrantRef, …) from the actor's actual children and EMPTIES them when it
 * thinks there are none. So on a live actor `set.system.props[containerKey]`
 * is {} — child relationships must be resolved via the `system.container`
 * back-pointer, which CSB never touches.
 */

const { getContainerChildItems, allRefIds } = await import("../services/csb-container-helpers.mjs");

const CHANGE_TEMPLATE = "WsrkfjBmudnIhvEK";
const OTHER_TEMPLATE = "someOtherTemplate";

function makeItemsCollection(items) {
    const map = new Map(items.map((i) => [i.id, i]));
    return {
        get: (id) => map.get(id),
        [Symbol.iterator]: () => map.values()
    };
}

function actor(items) {
    return { documentName: "Actor", items: makeItemsCollection(items) };
}

function child({ id, container, template = CHANGE_TEMPLATE, sourceContainer }) {
    return {
        id,
        system: { template, ...(container !== undefined ? { container } : {}) },
        ...(sourceContainer !== undefined
            ? { _source: { system: { container: sourceContainer } } }
            : {})
    };
}

function changeSet({ id, linkage, sourceLinkage }, containerKey = "ChangeDisplayer") {
    const set = { id, system: { template: "b7A1z6cSZO4dYTKT", props: {} } };
    if (linkage !== undefined) set.system.props[containerKey] = linkage;
    if (sourceLinkage !== undefined) set._source = { system: { props: { [containerKey]: sourceLinkage } } };
    return set;
}

console.log("getContainerChildItems...");

{
    // THE bug: linkage prop is empty (CSB cleared it), children found by container.
    const set = changeSet({ id: "cs-1", linkage: {} });
    const kids = [child({ id: "ch-1", container: "cs-1" }), child({ id: "ch-2", container: "cs-1" })];
    const a = actor([set, ...kids]);
    const out = getContainerChildItems(set, a, "ChangeDisplayer", CHANGE_TEMPLATE);
    assert.deepStrictEqual(out.map((i) => i.id).sort(), ["ch-1", "ch-2"]);
    console.log("  ✓ Finds children by system.container even when the linkage prop is empty");
}

{
    // Container back-pointer only in _source (prepared system.container absent).
    const set = changeSet({ id: "cs-1", linkage: {} });
    const kid = child({ id: "ch-1", container: undefined, sourceContainer: "cs-1" });
    const a = actor([set, kid]);
    const out = getContainerChildItems(set, a, "ChangeDisplayer", CHANGE_TEMPLATE);
    assert.deepStrictEqual(out.map((i) => i.id), ["ch-1"]);
    console.log("  ✓ Reads the container back-pointer from _source too");
}

{
    // Template filter excludes siblings of the wrong template.
    const set = changeSet({ id: "cs-1", linkage: {} });
    const kids = [
        child({ id: "ch-1", container: "cs-1" }),
        child({ id: "other", container: "cs-1", template: OTHER_TEMPLATE })
    ];
    const a = actor([set, ...kids]);
    const out = getContainerChildItems(set, a, "ChangeDisplayer", CHANGE_TEMPLATE);
    assert.deepStrictEqual(out.map((i) => i.id), ["ch-1"]);
    console.log("  ✓ Respects the expected-template filter");
}

{
    // Fallback: no container-children, resolve via the linkage prop (legacy data).
    const set = changeSet({ id: "cs-1", linkage: { "ch-1": { id: "ch-1" } } });
    const kid = child({ id: "ch-1", container: undefined }); // no back-pointer
    const a = actor([set, kid]);
    const out = getContainerChildItems(set, a, "ChangeDisplayer", CHANGE_TEMPLATE);
    assert.deepStrictEqual(out.map((i) => i.id), ["ch-1"]);
    console.log("  ✓ Falls back to the linkage prop when no container-children exist");
}

{
    // Fallback reads _source linkage when the prepared prop was emptied.
    const set = changeSet({ id: "cs-1", linkage: {}, sourceLinkage: { "ch-1": { id: "ch-1" } } });
    const kid = child({ id: "ch-1", container: undefined });
    const a = actor([set, kid]);
    const out = getContainerChildItems(set, a, "ChangeDisplayer", CHANGE_TEMPLATE);
    assert.deepStrictEqual(out.map((i) => i.id), ["ch-1"]);
    console.log("  ✓ Fallback reads the linkage from _source when prepared is emptied");
}

{
    // Container-scoped children win; no double-count with the linkage fallback.
    const set = changeSet({ id: "cs-1", linkage: { "ch-1": { id: "ch-1" } } });
    const kid = child({ id: "ch-1", container: "cs-1" });
    const a = actor([set, kid]);
    const out = getContainerChildItems(set, a, "ChangeDisplayer", CHANGE_TEMPLATE);
    assert.strictEqual(out.length, 1);
    console.log("  ✓ No double-count when both the container and the linkage point at a child");
}

console.log("allRefIds...");

{
    assert.deepStrictEqual(
        allRefIds({ a: { id: "a" }, b: { id: "b" }, c: { id: "c" } }),
        ["a", "b", "c"]
    );
    assert.deepStrictEqual(allRefIds(["x", "y"]), ["x", "y"]);
    assert.deepStrictEqual(allRefIds(["x", 3, ""]), ["x"]);
    assert.deepStrictEqual(allRefIds({}), []);
    assert.deepStrictEqual(allRefIds(null), []);
    assert.deepStrictEqual(allRefIds(undefined), []);
    assert.deepStrictEqual(allRefIds("nope"), []);
    console.log("  ✓ Returns every id from object/array refs; empty for blank/invalid");
}

console.log("\nAll csb-container-helpers tests passed.");
