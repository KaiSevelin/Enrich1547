/**
 * Monster Creation Wizard.
 *
 * A step-by-step Application that guides the GM through building a monster:
 * Name → Type → Role → Domain → Loadout → Motivation → Quirks → Boosts → Review.
 *
 * All steps after Name+Type are skippable. The wizard supports Back to revise
 * earlier choices. Quirks step allows any number. Boost step lets the GM
 * click once per intended roll; rolls are deferred and applied after actor
 * creation (using the existing boost-service).
 *
 * On Finish, the actor is created with TypeDropdown set (triggering Base
 * auto-apply), then user-selected ChangeSets are embedded, then planned
 * boosts are rolled and applied, then the actor sheet is opened.
 */

const MODULE_ID = "1547core";
const CHANGESET_TEMPLATE_ID = "b7A1z6cSZO4dYTKT";
const ACTOR_TYPES = [
    "HiddenFolk", "TheUnseen", "Beast", "Undead", "Colossal",
    "Unnatural", "Construct", "Zone", "People"
];

function getChangeSetsByGroup(group, typeFilter = null) {
    const all = [...(game.items?.values() ?? [])].filter((item) => {
        if (item.system?.template !== CHANGESET_TEMPLATE_ID) return false;
        return String(item.system?.props?.Group ?? "").trim() === group;
    });
    if (!typeFilter) return all;
    return all.filter((item) => {
        const props = item.system?.props ?? {};
        if (props.ForTypeAny === true) return true;
        return props[`ForType_${typeFilter}`] === true;
    });
}

function getChangeSetDescription(item) {
    const props = item.system?.props ?? {};
    return String(props.Description ?? props.Notes ?? "").trim() || item.name;
}

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

class MonsterWizard extends Application {
    constructor(options = {}) {
        super(options);
        this.state = {
            step: 0,
            name: "",
            typeKey: "",
            roleId: null,
            domainId: null,
            loadoutId: null,
            motivationId: null,
            quirkIds: [],
            actorId: null
        };
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "1547-monster-wizard",
            title: "Monster Wizard",
            template: null,
            width: 640,
            height: "auto",
            resizable: true,
            classes: ["dialog", "monster-wizard-1547core"]
        });
    }

    async _renderInner() {
        const html = this.#renderStep();
        return $(html);
    }

    #renderStep() {
        const s = this.state;
        const stepLabels = ["Name & Type", "Role", "Domain", "Loadout", "Motivation", "Quirks", "Review & Create", "Boosts (optional)"];
        const header = `<div class="mw-header"><strong>Step ${s.step + 1} of ${stepLabels.length}: ${stepLabels[s.step]}</strong></div>`;
        let body = "";
        switch (s.step) {
            case 0: body = this.#renderNameType(); break;
            case 1: body = this.#renderSingletonStep("Role", s.roleId); break;
            case 2: body = this.#renderSingletonStep("Domain", s.domainId); break;
            case 3: body = this.#renderSingletonStep("Loadout", s.loadoutId); break;
            case 4: body = this.#renderSingletonStep("Motivation", s.motivationId); break;
            case 5: body = this.#renderQuirksStep(); break;
            case 6: body = this.#renderReview(); break;
            case 7: body = this.#renderBoostStep(); break;
        }
        const nav = this.#renderNav();
        return `<form class="monster-wizard-1547core-form">${header}${body}${nav}</form>`;
    }

    #renderNameType() {
        const typeOptions = ACTOR_TYPES.map((t) => `<option value="${t}"${this.state.typeKey === t ? " selected" : ""}>${t}</option>`).join("");
        return `
            <div class="mw-body">
                <div class="mw-field">
                    <label>Monster Name</label>
                    <input type="text" name="mw-name" value="${escapeHtml(this.state.name)}" placeholder="e.g. Forest Wolf" />
                </div>
                <div class="mw-field">
                    <label>Type (base family)</label>
                    <select name="mw-type">
                        <option value="">— pick a type —</option>
                        ${typeOptions}
                    </select>
                    <small>Choosing a Type auto-applies the matching Base chassis.</small>
                </div>
            </div>
        `;
    }

    #renderSingletonStep(group, currentSelectedId) {
        const items = getChangeSetsByGroup(group, this.state.typeKey);
        const rows = items.map((item) => `
            <label class="mw-option${currentSelectedId === item.id ? " is-selected" : ""}">
                <input type="radio" name="mw-pick" value="${item.id}"${currentSelectedId === item.id ? " checked" : ""} />
                <div class="mw-option-body">
                    <div class="mw-option-name">${escapeHtml(item.name)}</div>
                    <div class="mw-option-desc">${escapeHtml(getChangeSetDescription(item))}</div>
                </div>
            </label>
        `).join("");
        return `
            <div class="mw-body">
                <p class="mw-step-help">Pick one ${group}, or skip this step.</p>
                <div class="mw-options">
                    ${rows || `<p class="mw-empty">No ${group} options available for type "${this.state.typeKey || "(none)"}". Skip to continue.</p>`}
                </div>
                ${currentSelectedId ? `<p class="mw-current">Current pick: ${escapeHtml(items.find(i=>i.id===currentSelectedId)?.name ?? currentSelectedId)}. <a class="mw-clear">Clear</a></p>` : ""}
            </div>
        `;
    }

    #renderQuirksStep() {
        const items = getChangeSetsByGroup("Quirk", this.state.typeKey);
        const selected = new Set(this.state.quirkIds);
        const rows = items.map((item) => `
            <label class="mw-option${selected.has(item.id) ? " is-selected" : ""}">
                <input type="checkbox" name="mw-quirk" value="${item.id}"${selected.has(item.id) ? " checked" : ""} />
                <div class="mw-option-body">
                    <div class="mw-option-name">${escapeHtml(item.name)}</div>
                    <div class="mw-option-desc">${escapeHtml(getChangeSetDescription(item))}</div>
                </div>
            </label>
        `).join("");
        return `
            <div class="mw-body">
                <p class="mw-step-help">Pick any number of Quirks, or none. No hard cap.</p>
                <div class="mw-options">${rows || `<p class="mw-empty">No Quirks available.</p>`}</div>
                <p class="mw-current">Selected: ${selected.size}</p>
            </div>
        `;
    }

    #renderBoostStep() {
        const actor = this.state.actorId ? game.actors?.get(this.state.actorId) : null;
        const appliedBoosts = actor
            ? actor.items.filter((it) => it.system?.props?.Group === "Boost").length
            : 0;
        const actorName = actor ? escapeHtml(actor.name) : "(actor missing)";
        return `
            <div class="mw-body">
                <p class="mw-step-help">${actorName} is created. Click <strong>Roll Boost</strong> to roll once on the Standard Boost table — you'll see a preview and choose Apply or Skip. Roll as many as you like, or click <strong>Done</strong> to finish and open the sheet.</p>
                <div class="mw-boost-controls">
                    <button type="button" class="mw-boost-roll"${actor ? "" : " disabled"}>Roll Boost</button>
                    <span class="mw-boost-count">Boosts applied: <strong>${appliedBoosts}</strong></span>
                </div>
                <p class="mw-step-help"><em>Each Roll Boost click resolves immediately — apply or skip the rolled boost before rolling again.</em></p>
            </div>
        `;
    }

    #renderReview() {
        const s = this.state;
        function lookupName(id) {
            const item = game.items?.get(id);
            return item?.name ?? "(unknown)";
        }
        const lines = [
            ["Name", s.name || "(unnamed)"],
            ["Type", s.typeKey || "(none — required!)"],
            ["Role", s.roleId ? lookupName(s.roleId) : "(skipped)"],
            ["Domain", s.domainId ? lookupName(s.domainId) : "(skipped)"],
            ["Loadout", s.loadoutId ? lookupName(s.loadoutId) : "(skipped)"],
            ["Motivation", s.motivationId ? lookupName(s.motivationId) : "(skipped)"],
            ["Quirks", s.quirkIds.length ? s.quirkIds.map(lookupName).join(", ") : "(none)"]
        ];
        const rows = lines.map(([k, v]) => `<div class="mw-review-row"><span class="mw-review-key">${k}:</span> <span class="mw-review-val">${escapeHtml(v)}</span></div>`).join("");
        const created = !!this.state.actorId;
        const cta = created
            ? `<p class="mw-step-help"><em>Actor already created — click Next to roll boosts, or Cancel to dismiss.</em></p>`
            : `<p class="mw-step-help">Click <strong>Create Actor</strong> to build the monster — then you'll roll boosts in the next step.</p>`;
        return `<div class="mw-body"><h3>Review</h3>${rows}${cta}</div>`;
    }

    #renderNav() {
        const step = this.state.step;
        const first = step === 0;
        const onReview = step === 6;
        const onBoost = step === 7;
        const canCreate = this.state.typeKey && this.state.name.trim();
        const alreadyCreated = !!this.state.actorId;
        const isSkippable = step > 0 && step < 6;
        let primaryBtn;
        if (onBoost) {
            primaryBtn = `<button type="button" class="mw-done">Done</button>`;
        } else if (onReview) {
            primaryBtn = alreadyCreated
                ? `<button type="button" class="mw-next">Next</button>`
                : `<button type="button" class="mw-create"${canCreate ? "" : " disabled"}>Create Actor</button>`;
        } else {
            primaryBtn = `<button type="button" class="mw-next">Next</button>`;
        }
        return `
            <div class="mw-nav">
                <button type="button" class="mw-cancel">Cancel</button>
                <button type="button" class="mw-back"${first || alreadyCreated ? " disabled" : ""}>Back</button>
                ${isSkippable ? '<button type="button" class="mw-skip">Skip</button>' : ""}
                ${primaryBtn}
            </div>
        `;
    }

    activateListeners(html) {
        super.activateListeners(html);
        const root = html[0] ?? html;
        const $ = (sel) => root.querySelector(sel);

        $(".mw-cancel")?.addEventListener("click", () => this.close());
        $(".mw-back")?.addEventListener("click", () => { this.state.step = Math.max(0, this.state.step - 1); this.render(true); });
        $(".mw-skip")?.addEventListener("click", () => { this.#clearStep(); this.state.step++; this.render(true); });
        $(".mw-next")?.addEventListener("click", () => this.#onNext());
        $(".mw-create")?.addEventListener("click", () => this.#onCreate());
        $(".mw-done")?.addEventListener("click", () => this.#onDone());

        // Step 0: name + type
        $("[name='mw-name']")?.addEventListener("input", (e) => { this.state.name = e.target.value; });
        $("[name='mw-type']")?.addEventListener("change", (e) => {
            this.state.typeKey = e.target.value;
            // Reset downstream picks since available options depend on type
            this.state.roleId = null;
            this.state.domainId = null;
            this.state.loadoutId = null;
            this.state.motivationId = null;
            this.state.quirkIds = [];
        });

        // Steps 1-4: singleton radios + clear
        root.querySelectorAll("input[name='mw-pick']").forEach((input) => {
            input.addEventListener("change", (e) => {
                const id = e.target.value;
                if (this.state.step === 1) this.state.roleId = id;
                if (this.state.step === 2) this.state.domainId = id;
                if (this.state.step === 3) this.state.loadoutId = id;
                if (this.state.step === 4) this.state.motivationId = id;
                this.render(true);
            });
        });
        $(".mw-clear")?.addEventListener("click", () => {
            if (this.state.step === 1) this.state.roleId = null;
            if (this.state.step === 2) this.state.domainId = null;
            if (this.state.step === 3) this.state.loadoutId = null;
            if (this.state.step === 4) this.state.motivationId = null;
            this.render(true);
        });

        // Step 5: quirk checkboxes
        root.querySelectorAll("input[name='mw-quirk']").forEach((cb) => {
            cb.addEventListener("change", (e) => {
                const id = e.target.value;
                const set = new Set(this.state.quirkIds);
                if (e.target.checked) set.add(id); else set.delete(id);
                this.state.quirkIds = [...set];
                this.render(true);
            });
        });

        // Step 7: boost roll — calls boostActor immediately (apply/skip prompt is in that service)
        $(".mw-boost-roll")?.addEventListener("click", async (ev) => {
            const btn = ev.currentTarget;
            if (!this.state.actorId) return;
            btn.disabled = true;
            try {
                const moduleApi = game.modules.get(MODULE_ID)?.api;
                if (typeof moduleApi?.boostActor !== "function") {
                    ui.notifications.error("1547 Core: boost service not loaded.");
                    return;
                }
                await moduleApi.boostActor(this.state.actorId);
            } catch (err) {
                console.error(`${MODULE_ID} | wizard boost roll failed`, err);
                ui.notifications.error("1547 Core: boost roll failed — see console.");
            } finally {
                btn.disabled = false;
                this.render(true);
            }
        });
    }

    #clearStep() {
        if (this.state.step === 1) this.state.roleId = null;
        if (this.state.step === 2) this.state.domainId = null;
        if (this.state.step === 3) this.state.loadoutId = null;
        if (this.state.step === 4) this.state.motivationId = null;
        if (this.state.step === 5) this.state.quirkIds = [];
    }

    #onNext() {
        if (this.state.step === 0) {
            if (!this.state.name.trim()) return ui.notifications.warn("Monster needs a name.");
            if (!this.state.typeKey) return ui.notifications.warn("Pick a Type.");
        }
        this.state.step = Math.min(7, this.state.step + 1);
        this.render(true);
    }

    async #onCreate() {
        const s = this.state;
        if (!s.name.trim() || !s.typeKey) {
            ui.notifications.warn("Monster requires a Name and Type.");
            return;
        }
        if (s.actorId) {
            // Already created — just advance to boost step.
            this.state.step = 7;
            this.render(true);
            return;
        }
        try {
            const actorFolder = game.folders?.find((f) => f.type === "Actor" && f.name === "Monsters") ?? null;

            const actor = await Actor.create({
                name: s.name,
                type: "_template",
                folder: actorFolder?.id ?? null,
                system: { props: { TypeDropdown: s.typeKey } }
            });

            // Wait briefly for Base auto-apply to settle so natural weapons/armor exist.
            await new Promise((r) => setTimeout(r, 250));

            const picked = [s.roleId, s.domainId, s.loadoutId, s.motivationId, ...s.quirkIds].filter(Boolean);
            const itemDataArr = [];
            for (const id of picked) {
                const worldItem = game.items?.get(id);
                if (!worldItem) continue;
                const data = worldItem.toObject();
                delete data._id;
                itemDataArr.push(data);
            }
            if (itemDataArr.length) {
                await actor.createEmbeddedDocuments("Item", itemDataArr);
            }

            this.state.actorId = actor.id;
            ui.notifications.info(`1547 Core: created ${actor.name} with ${itemDataArr.length} ChangeSet(s). Roll boosts or click Done.`);

            this.state.step = 7;
            this.render(true);
        } catch (err) {
            console.error(`${MODULE_ID} | Monster wizard create failed`, err);
            ui.notifications.error(`1547 Core: monster wizard failed — ${err.message}`);
        }
    }

    #onDone() {
        const actor = this.state.actorId ? game.actors?.get(this.state.actorId) : null;
        this.close();
        actor?.sheet?.render(true);
    }
}

function injectWizardButton(html) {
    const root = html?.[0] ?? html;
    if (!root?.querySelector) return;
    const header = root.querySelector(".directory-header") ?? root.querySelector("header");
    if (!header) return;
    if (header.querySelector(".mw-launch")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mw-launch";
    btn.style.cssText = "margin: 4px; padding: 4px 8px; cursor: pointer;";
    btn.textContent = "Monster Wizard";
    btn.title = "Open the guided monster creation wizard (1547 Core)";
    btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        new MonsterWizard().render(true);
    });
    header.appendChild(btn);
}

export function registerMonsterWizard() {
    Hooks.on("renderActorDirectory", (app, html) => {
        if (!game.user?.isGM) return;
        injectWizardButton(html);
    });

    const moduleApi = game.modules.get(MODULE_ID);
    if (!moduleApi) {
        console.warn(`${MODULE_ID} | registerMonsterWizard: module not found`);
        return;
    }
    moduleApi.api = moduleApi.api ?? {};
    moduleApi.api.openMonsterWizard = () => new MonsterWizard().render(true);
}
