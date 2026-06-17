import assert from "assert";
import {
    createSocketWorld,
    makeActor,
    makeRecordingPresenter,
    makeInformationalPresenter,
    flush,
    sleep,
} from "./socket-harness.mjs";

const KIND = "reaction";

// 1) Full round-trip: GM (acting) relays a reaction window to a player; the
//    player's presenter fires; the player's choice routes back to the GM's
//    onResolve. This is the core cross-client reaction handshake.
{
    console.log("relay: GM → player request/response round-trip...");
    const world = createSocketWorld();
    const gm = await world.addClient({ id: "gm", isGM: true });
    const p1 = await world.addClient({ id: "p1" });
    const presenter = makeRecordingPresenter();
    p1.instance.registerRemoteWindowPresenter(KIND, presenter.present);

    const actor = makeActor({ id: "pc1", name: "Adso", owners: ["p1"] });
    let resolved = "UNSET";
    const relayed = world.runAs(gm, () => gm.instance.relayRemoteWindow({
        kind: KIND, windowId: "w1", responderActor: actor,
        request: { candidates: [{ id: "face:pc1", label: "Face" }] },
        onResolve: (id) => { resolved = id; },
    }));
    assert.strictEqual(relayed, true, "relay returns true when a remote responder exists");

    await flush();
    assert.strictEqual(presenter.calls.length, 1, "player presenter was invoked once");
    assert.strictEqual(presenter.calls[0].msg.windowId, "w1");
    assert.strictEqual(presenter.calls[0].msg.kind, KIND);
    assert.deepStrictEqual(presenter.calls[0].msg.toUserIds, ["p1"], "addressed to the owning player");
    assert.strictEqual(presenter.calls[0].msg.forActorId, "pc1");

    // Player chooses — resolve under p1 globals so the response emits from p1.
    world.runAs(p1, () => presenter.calls[0].resolve("face:pc1"));
    await flush();
    assert.strictEqual(resolved, "face:pc1", "GM's onResolve received the player's choice");
    console.log("  ✓ request reaches the owner, choice routes back to the acting client");
}

// 2) pickResponders: a player owner is preferred; a player acting on an actor it
//    can't decide falls back to the GM; a GM acting on its own actor needs nobody.
{
    console.log("relay: pickResponders ownership routing...");
    const world = createSocketWorld();
    const gm = await world.addClient({ id: "gm", isGM: true });
    const p1 = await world.addClient({ id: "p1" });
    const p2 = await world.addClient({ id: "p2" });

    const ownedByP1 = makeActor({ id: "pc1", owners: ["p1"] });
    const gmNpc = makeActor({ id: "npc1", owners: ["gm"] });

    let r;
    r = world.runAs(gm, () => gm.instance.pickResponders(ownedByP1));
    assert.deepStrictEqual(r.map((u) => u.id), ["p1"], "GM acting → the owning player decides");

    // The owning player decides even when a DIFFERENT player is acting.
    r = world.runAs(p2, () => p2.instance.pickResponders(ownedByP1));
    assert.deepStrictEqual(r.map((u) => u.id), ["p1"], "owner decides regardless of who acts");

    // No player owns it and the acting player isn't an owner → fall back to the GM.
    r = world.runAs(p2, () => p2.instance.pickResponders(gmNpc));
    assert.deepStrictEqual(r.map((u) => u.id), ["gm"], "player acting on a GM NPC → GM decides");

    r = world.runAs(gm, () => gm.instance.pickResponders(gmNpc));
    assert.deepStrictEqual(r, [], "GM acting on a GM-owned actor → nobody to relay to");
    console.log("  ✓ owner-decides (any actor), GM fallback for unowned, GM self-owned no-op");
}

// 3) First-wins: two owners both get the window; the first to answer wins and the
//    other client's open prompt is torn down via the close broadcast.
{
    console.log("relay: first-wins closes the sibling owner's prompt...");
    const world = createSocketWorld();
    const gm = await world.addClient({ id: "gm", isGM: true });
    const p1 = await world.addClient({ id: "p1" });
    const p2 = await world.addClient({ id: "p2" });
    const presP1 = makeRecordingPresenter();
    const presP2 = makeRecordingPresenter();
    p1.instance.registerRemoteWindowPresenter(KIND, presP1.present);
    p2.instance.registerRemoteWindowPresenter(KIND, presP2.present);

    const shared = makeActor({ id: "pc1", owners: ["p1", "p2"] });
    let resolved = "UNSET";
    world.runAs(gm, () => gm.instance.relayRemoteWindow({
        kind: KIND, windowId: "w3", responderActor: shared,
        onResolve: (id) => { resolved = id; },
    }));
    await flush();
    assert.strictEqual(presP1.calls.length, 1, "p1 prompted");
    assert.strictEqual(presP2.calls.length, 1, "p2 prompted");

    world.runAs(p1, () => presP1.calls[0].resolve("def-1"));
    await flush();
    assert.strictEqual(resolved, "def-1", "first responder's choice wins");
    assert.strictEqual(presP2.calls[0].closeCalled, true, "the slower owner's prompt was closed");
    console.log("  ✓ both owners prompted, first answer wins, the other is closed");
}

// 4) Informational window (expectsResponse:false): the presenter runs on the
//    owner's client but no response is sent back (e.g. the defense summary).
{
    console.log("relay: informational window (no response)...");
    const world = createSocketWorld();
    const gm = await world.addClient({ id: "gm", isGM: true });
    const p1 = await world.addClient({ id: "p1" });
    const info = makeInformationalPresenter();
    p1.instance.registerRemoteWindowPresenter("defense-summary", info.present);

    const actor = makeActor({ id: "pc1", owners: ["p1"] });
    let resolveCalled = false;
    const relayed = world.runAs(gm, () => gm.instance.relayRemoteWindow({
        kind: "defense-summary", windowId: "w4", responderActor: actor,
        expectsResponse: false,
        onResolve: () => { resolveCalled = true; },
    }));
    assert.strictEqual(relayed, true);
    await flush();
    assert.strictEqual(info.calls.length, 1, "informational presenter ran on the owner");
    assert.strictEqual(resolveCalled, false, "no response path for informational windows");
    console.log("  ✓ owner is informed, acting client never waits for a reply");
}

// 5) userConnected re-send: a responder who (re)connects after the broadcast gets
//    the still-pending window re-sent to them alone.
{
    console.log("relay: userConnected re-sends a pending window...");
    const world = createSocketWorld();
    const gm = await world.addClient({ id: "gm", isGM: true });
    const p1 = await world.addClient({ id: "p1" });
    const presenter = makeRecordingPresenter();
    p1.instance.registerRemoteWindowPresenter(KIND, presenter.present);

    const actor = makeActor({ id: "pc1", owners: ["p1"] });
    world.runAs(gm, () => gm.instance.relayRemoteWindow({
        kind: KIND, windowId: "w5", responderActor: actor, onResolve: () => {},
    }));
    await flush();
    assert.strictEqual(presenter.calls.length, 1, "delivered once on the initial broadcast");

    // p1 reconnects — the GM re-sends the pending window to p1.
    world.fireUserConnected(gm, p1.user, true);
    await flush();
    assert.strictEqual(presenter.calls.length, 2, "pending window re-sent to the reconnecting owner");
    assert.deepStrictEqual(presenter.calls[1].msg.toUserIds, ["p1"], "re-send is addressed to them alone");
    console.log("  ✓ a late/reconnecting responder receives the pending window");
}

// 6) Timeout auto-pass: when no responder answers, the acting client resolves null
//    after the deadline (a little past the responder's own, so a real answer wins).
{
    console.log("relay: acting-side timeout auto-passes...");
    const world = createSocketWorld();
    const gm = await world.addClient({ id: "gm", isGM: true });
    const p1 = await world.addClient({ id: "p1" });
    const presenter = makeRecordingPresenter(); // never resolved
    p1.instance.registerRemoteWindowPresenter(KIND, presenter.present);

    const actor = makeActor({ id: "pc1", owners: ["p1"] });
    let resolved = "UNSET";
    world.runAs(gm, () => gm.instance.relayRemoteWindow({
        kind: KIND, windowId: "w6", responderActor: actor, timeoutMs: 10,
        onResolve: (id) => { resolved = id; },
    }));
    await flush();
    assert.strictEqual(presenter.calls.length, 1, "still presented");
    assert.strictEqual(resolved, "UNSET", "not resolved before the deadline");

    await sleep(600); // acting-side backstop is timeoutMs + 500
    assert.strictEqual(resolved, null, "auto-passed (null) after the deadline");
    console.log("  ✓ unanswered window auto-passes on the acting client");
}

console.log("\nremote-window-relay.test.mjs — all assertions passed.");
