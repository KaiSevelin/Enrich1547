import {
    buildCombinedFormula,
    formatDiceTerm,
    parseDiceTerm,
} from "../utils/dice.js";

export function register1547DialogHooks() {
    Hooks.on("renderDialog", (_app, html) => {
        if (!html.find("form.dialog-1547").length) return;

        bind1547DialogControls(html);
    });
}

function bind1547DialogControls(html) {
    const updateRow = (index, nextValue) => {
        const input = html.find(`input.dice-term[data-index="${index}"]`)[0];
        if (input) input.value = nextValue;
    };

    html
        .find("button.dice-plus")
        .off("click.en1547")
        .on("click.en1547", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const input = getDiceInputForButton(html, event.currentTarget);
            const parsed = parseDiceTerm((input?.value ?? "").trim());
            if (!parsed) return;

            parsed.n = Math.max(0, parsed.n + 1);
            updateRow(input.dataset.index, formatDiceTerm(parsed));
        });

    html
        .find("button.dice-minus")
        .off("click.en1547")
        .on("click.en1547", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const input = getDiceInputForButton(html, event.currentTarget);
            const parsed = parseDiceTerm((input?.value ?? "").trim());
            if (!parsed) return;

            parsed.n = Math.max(0, parsed.n - 1);
            updateRow(input.dataset.index, formatDiceTerm(parsed));
        });
}

function getDiceInputForButton(html, button) {
    const row = button.closest(".dice-row");
    const index = row?.dataset.index;
    return html.find(`input.dice-term[data-index="${index}"]`)[0];
}

export async function show1547RollDialog(formulas, titleLabel = "@1547") {
    const state = formulas.map((formula) => {
        const parsed = parseDiceTerm(formula);
        return {
            parsed,
            value: parsed ? formatDiceTerm(parsed) : formula,
        };
    });

    const content = `
    <form class="dialog-1547">
      <p>Adjust dice then roll:</p>
      <div class="dice-list">
        ${state
            .map((entry, index) => {
                const disabled = entry.parsed ? "" : "disabled";
                return `
              <div class="dice-row" data-index="${index}">
                <button type="button" class="dice-minus" ${disabled} title="Remove one die">-</button>
                <input type="text" class="dice-term" value="${foundry.utils.escapeHTML(entry.value)}" data-index="${index}" />
                <button type="button" class="dice-plus" ${disabled} title="Add one die">+</button>
              </div>
            `;
            })
            .join("")}
      </div>

      <hr />
      <p class="hint" style="opacity: 0.8; font-size: 0.9em;">
        Roll will combine everything into one roll (e.g. 1d6 + 2d6).
      </p>
    </form>
  `;

    const dialog = new Dialog({
        title: `${titleLabel} Roll`,
        content,
        buttons: {
            roll: {
                icon: '<i class="fas fa-dice"></i>',
                label: "Roll",
                callback: async (html) => {
                    const terms = html
                        .find("input.dice-term")
                        .toArray()
                        .map((input) => input.value.trim())
                        .filter(Boolean);

                    if (!terms.length) {
                        ui.notifications?.warn("No dice terms to roll.");
                        return;
                    }

                    await rollCombinedToChat(
                        buildCombinedFormula(terms),
                        titleLabel,
                        terms
                    );
                },
            },
            close: { label: "Close" },
        },
        default: "roll",
    });

    dialog.render(true);
}

async function rollCombinedToChat(combinedFormula, titleLabel, terms) {
    try {
        const roll = await new Roll(combinedFormula).evaluate({ async: true });
        await roll.toMessage({
            flavor: `${titleLabel}: ${terms.join(" + ")}`,
            speaker: ChatMessage.getSpeaker(),
        });
    } catch (error) {
        console.error(error);
        ui.notifications?.error(`Invalid combined roll: ${combinedFormula}`);
    }
}
