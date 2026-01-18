// scripts/enrich-1547.js
Hooks.once("ready", () => {
    // Capture-phase helps when other listeners stop propagation
    document.body.addEventListener("click", async (ev) => {
        const el = ev.target?.closest?.("a.enricher-1547");
        if (!el) return;

        ev.preventDefault();
        ev.stopPropagation();

        let rolls;
        try {
            rolls = JSON.parse(el.dataset.rolls ?? "[]");
        } catch {
            rolls = [];
        }

        if (!Array.isArray(rolls) || rolls.length === 0) {
            return ui.notifications?.warn("No roll formulas found in @1547[...]");
        }

        const label = el.dataset.label ?? "@1547";
        await show1547RollDialog(rolls, label);
    }, true);

    // Optional: allow keyboard activation (Enter/Space)
    document.body.addEventListener("keydown", async (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const el = ev.target?.closest?.("a.enricher-1547");
        if (!el) return;
        el.click();
    }, true);
});
Hooks.once("init", () => {
  CONFIG.TextEditor.enrichers.push({
    // @1547[...]{...}
    pattern: /@1547\[([^\]]+)\](?:\{([^}]+)\})?/g,
      enricher: async (match, options) => {
          const raw = match[1] ?? "";
          const label = match[2] ?? "@1547";

          const rolls = raw
              .split("|")
              .map(s => s.trim())
              .filter(Boolean);

          // Store data on the element; do NOT attach listeners here
          const a = document.createElement("a");
          a.classList.add("enricher-1547");
          a.dataset.rolls = JSON.stringify(rolls);
          a.dataset.label = label;
          a.innerHTML = label;

          // Optional: make it behave like a link for accessibility
          a.setAttribute("role", "button");
          a.tabIndex = 0;

          return a;
      },
      replaceParent: false
  });
});

/**
 * Show a dialog listing the formulas and providing Roll buttons.
 */
async function show1547RollDialog(formulas, titleLabel = "@1547") {
  // Build dialog HTML
  const rows = formulas.map((f, i) => `
    <div class="form-group" style="display:flex; gap:.5rem; align-items:center;">
      <input type="text" name="formula" data-index="${i}" value="${foundry.utils.escapeHTML(f)}" style="flex:1;" />
      <button type="button" class="roll-one" data-index="${i}">
        <i class="fas fa-dice-d20"></i>
      </button>
    </div>
  `).join("");

  const content = `
    <form class="dialog-1547">
      <p>Rolls:</p>
      ${rows}
      <hr/>
      <p style="opacity:.8; font-size:.9em;">
        Edit formulas above if you want before rolling.
      </p>
    </form>
  `;

  const dlg = new Dialog({
    title: `${titleLabel} Rolls`,
    content,
    buttons: {
      rollAll: {
        icon: '<i class="fas fa-dice"></i>',
        label: "Roll All",
        callback: async (html) => {
          const inputs = html.find('input[name="formula"]').toArray();
          const toRoll = inputs.map(i => i.value.trim()).filter(Boolean);
          await rollManyToChat(toRoll);
        }
      },
      close: { label: "Close" }
    },
    render: (html) => {
      // Per-roll button behavior
      html.find("button.roll-one").on("click", async (ev) => {
        ev.preventDefault();
        const idx = Number(ev.currentTarget.dataset.index);
        const input = html.find(`input[name="formula"][data-index="${idx}"]`)[0];
        const formula = (input?.value ?? "").trim();
        if (!formula) return;
        await rollOneToChat(formula);
      });
    }
  });

  dlg.render(true);
}

async function rollOneToChat(formula) {
  try {
    const roll = await (new Roll(formula)).evaluate({ async: true });
    await roll.toMessage({
      flavor: `@1547: ${formula}`,
      speaker: ChatMessage.getSpeaker()
    });
  } catch (err) {
    console.error(err);
    ui.notifications?.error(`Invalid roll: ${formula}`);
  }
}

async function rollManyToChat(formulas) {
  for (const f of formulas) {
    await rollOneToChat(f);
  }
}
