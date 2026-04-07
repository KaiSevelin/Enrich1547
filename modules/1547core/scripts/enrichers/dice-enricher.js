import { show1547RollDialog } from "../dialogs/roll-dialog.js";

const EN1547_DEBUG = false;

export function register1547Enricher() {
    CONFIG.TextEditor.enrichers.push({
        pattern: /@1547\[([^\]]+)\](?:\{([^}]+)\})?/g,
        enricher: async (match) => {
            const raw = match[1] ?? "";
            const label = match[2] ?? "@1547";
            const rolls = raw
                .split("|")
                .map((term) => term.trim())
                .filter(Boolean);

            const link = document.createElement("a");
            link.classList.add("enricher-1547");
            link.dataset.rolls = JSON.stringify(rolls);
            link.dataset.label = label;
            link.textContent = label;
            link.setAttribute("role", "button");
            link.tabIndex = 0;

            return link;
        },
        replaceParent: false,
    });

    if (EN1547_DEBUG) console.log("1547Core | init complete");
}

export function activate1547EnricherListeners(root = document.body) {
    root.addEventListener(
        "click",
        async (event) => {
            const link = event.target?.closest?.("a.enricher-1547");
            if (!link) return;

            event.preventDefault();
            event.stopPropagation();

            let rolls;
            try {
                rolls = JSON.parse(link.dataset.rolls ?? "[]");
            } catch {
                rolls = [];
            }

            if (!Array.isArray(rolls) || rolls.length === 0) {
                ui.notifications?.warn("No roll formulas found in @1547[...]");
                return;
            }

            await show1547RollDialog(rolls, link.dataset.label ?? "@1547");
        },
        true
    );

    root.addEventListener(
        "keydown",
        (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;

            const link = event.target?.closest?.("a.enricher-1547");
            if (!link) return;

            event.preventDefault();
            link.click();
        },
        true
    );

    if (EN1547_DEBUG) {
        console.log("1547Core | ready complete");
        ui.notifications?.info("1547Core: module loaded (debug on)");
    }
}
