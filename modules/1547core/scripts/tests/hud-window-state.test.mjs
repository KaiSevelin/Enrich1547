// HUD window-state transitions (hud/hud-state.js, ADR-0004): the
// invariant-carrying exchange state now has one mutation point — these are
// the transitions the facade guarantees. hud-state.js is Foundry-free, so
// this runs headless.
import assert from "node:assert/strict";
import {
    HUD_STATE,
    setReactionWindowState,
    clearReactionWindowState,
    getReactionWindowState,
    setSelectedReactionChoiceId,
    getSelectedReactionChoiceId,
    queuePostManeuverWindow,
    getActivePostManeuverWindow,
    advancePostManeuverWindow,
    clearPostManeuverWindows,
    setDeferredPostManeuverWindows,
    releaseDeferredPostManeuverWindows,
    getSelectedPostManeuverId,
    toggleSelectedPostManeuver,
    syncManeuverFilterContext,
} from "../hud/hud-state.js";

console.log("hud-state: view/window split...");
{
    assert.ok(HUD_STATE.view && typeof HUD_STATE.view === "object", "view sub-object exists");
    assert.equal(HUD_STATE.view.activeCategory, "overview");
    assert.ok(!("reactionWindow" in HUD_STATE.view), "window state is NOT in view");
    assert.equal(HUD_STATE.reactionWindow, null);
    console.log("  ✓ toggles under view, window state top-level");
}

console.log("hud-state: reaction window transitions...");
{
    setSelectedReactionChoiceId("stale-choice");
    const win = { trigger: "attack", expiresAt: 999 };
    const previous = setReactionWindowState(win);
    assert.equal(previous, null, "returns prior window (none)");
    assert.equal(getReactionWindowState(), win);
    assert.equal(getSelectedReactionChoiceId(), null, "opening a window resets the stale choice");

    setSelectedReactionChoiceId("evade");
    const replaced = setReactionWindowState({ trigger: "threat" });
    assert.equal(replaced, win, "returns the replaced window");
    assert.equal(getSelectedReactionChoiceId(), null, "replacement resets the choice too");

    setSelectedReactionChoiceId("face");
    const closed = clearReactionWindowState();
    assert.equal(closed?.trigger, "threat");
    assert.equal(getReactionWindowState(), null);
    assert.equal(getSelectedReactionChoiceId(), null, "closing clears the choice");
    console.log("  ✓ open/replace/close all reset the choice selection");
}

console.log("hud-state: post-maneuver queue FIFO + deferred release...");
{
    clearPostManeuverWindows();
    queuePostManeuverWindow({ id: "w1", selectedPostManeuver: { id: "m1" } });
    queuePostManeuverWindow({ id: "w2" });
    assert.equal(getActivePostManeuverWindow().id, "w1", "FIFO head");
    assert.equal(getSelectedPostManeuverId("w1"), "m1", "initial selection captured");

    toggleSelectedPostManeuver("w2", "m9");
    const finished = advancePostManeuverWindow();
    assert.equal(finished.id, "w1");
    assert.equal(getSelectedPostManeuverId("w1"), null, "advancing clears the finished window's selection");
    assert.equal(getActivePostManeuverWindow().id, "w2");
    assert.equal(getSelectedPostManeuverId("w2"), "m9", "other windows' selections survive");

    // Deferred windows queue back in order on release.
    clearPostManeuverWindows();
    setDeferredPostManeuverWindows([{ id: "d1" }, { id: "d2" }, { bad: true }]);
    const released = releaseDeferredPostManeuverWindows();
    assert.deepEqual(released.map((w) => w.id), ["d1", "d2"], "id-less entries dropped");
    assert.equal(getActivePostManeuverWindow().id, "d1");
    assert.deepEqual(releaseDeferredPostManeuverWindows(), [], "release drains the deferred list");
    clearPostManeuverWindows();
    console.log("  ✓ FIFO, per-window selections, deferred release drains");
}

console.log("hud-state: syncManeuverFilterContext (context follows, manual pick sticks)...");
{
    HUD_STATE.view.maneuverFilter = "all";
    HUD_STATE.view.maneuverFilterContext = null;
    syncManeuverFilterContext("reaction");
    assert.equal(HUD_STATE.view.maneuverFilter, "reaction", "context change moves the filter");

    // Manual pick within the SAME context sticks…
    HUD_STATE.view.maneuverFilter = "full-turn";
    syncManeuverFilterContext("reaction");
    assert.equal(HUD_STATE.view.maneuverFilter, "full-turn", "same context leaves a manual pick alone");

    // …until the context changes again.
    syncManeuverFilterContext("post");
    assert.equal(HUD_STATE.view.maneuverFilter, "post");
    console.log("  ✓ contextual default vs sticky manual pick");
}

console.log("\nAll hud-window-state tests passed.");
