import {DiceSystem} from '../../../dice-so-nice/api.js';
import {DieArmor} from './armor.js';
import {DieBalanced} from './balanced.js';
import {DieControl} from './control.js';
import {DieEvade} from './evade.js';
import {DieFinesse} from './finesse.js';
import {DieHeavy} from './heavy.js';
import {DieLethality} from './lethality.js';
import {DieMultiplier} from './multiplier.js';
import {DiePenetration} from './penetration.js';
import {DieRisk} from './risk.js';

const MODULE_ID = "dice1547";
// Roll-result flags must be stored under an *active* module scope. The standalone
// "dice1547" module was consolidated into 1547core, so its id is no longer an
// active flag scope — writing under it throws. Store under "1547core" instead;
// reads fall back to the legacy scope for chat messages stamped before this.
const FLAG_SCOPE = "1547core";

function getDieType(dice) {
    if (dice instanceof DieArmor) return "armor";
    if (dice instanceof DieBalanced) return "balanced";
    if (dice instanceof DieControl) return "control";
    if (dice instanceof DieEvade) return "evade";
    if (dice instanceof DieFinesse) return "grace";
    if (dice instanceof DieHeavy) return "heavy";
    if (dice instanceof DieLethality) return "lethality";
    if (dice instanceof DieMultiplier) return "multiplier";
    if (dice instanceof DiePenetration) return "penetration";
    if (dice instanceof DieRisk) return "risk";
    return null;
}

function getFaceTotals(dieType, face) {
    switch (dieType) {
        case "armor":
            switch (face) {
                case 1: return { fumble: 1 };
                case 3: return { protection: 1 };
                case 4: return { protection: 2 };
                case 5: return { protection: 4 };
                case 6: return { crit: 1 };
                default: return {};
            }
        case "balanced":
            switch (face) {
                case 1: return { fumble: 1 };
                case 3:
                case 4: return { damage: 1 };
                case 5: return { damage: 2 };
                case 6: return { crit: 1 };
                default: return {};
            }
        case "control":
            switch (face) {
                case 1: return { fumble: 1 };
                case 4: return { damage: 1 };
                case 5:
                case 6: return { crit: 1 };
                default: return {};
            }
        case "evade":
            switch (face) {
                case 1: return { fumble: 1 };
                case 3: return { protection: 1 };
                case 4: return { protection: 2 };
                case 5:
                case 6: return { crit: 1 };
                default: return {};
            }
        case "grace":
            switch (face) {
                case 3:
                case 4: return { damage: 1 };
                case 5:
                case 6: return { crit: 1 };
                default: return {};
            }
        case "heavy":
            switch (face) {
                case 1:
                case 2: return { fumble: 1 };
                case 3: return { damage: 1 };
                case 4: return { damage: 2 };
                case 5: return { damage: 4 };
                case 6: return { crit: 1 };
                default: return {};
            }
        case "lethality":
            switch (face) {
                case 1:
                case 2: return { fumble: 1 };
                case 3: return { damage: 2 };
                case 4: return { damage: 3 };
                case 5: return { damage: 5 };
                case 6: return { crit: 1 };
                default: return {};
            }
        case "multiplier":
            switch (face) {
                case 1: return { multiplier: 0 };
                case 4:
                case 5: return { multiplier: 2 };
                case 6: return { multiplier: 3 };
                default: return {};
            }
        case "penetration":
            switch (face) {
                case 1: return { fumble: 1 };
                case 3:
                case 4: return { damage: 1 };
                case 5: return { damage: 3 };
                case 6: return { crit: 1 };
                default: return {};
            }
        case "risk":
            switch (face) {
                case 1: return { multiplier: 0 };
                case 2:
                case 3: return { fumble: 1 };
                case 5: return { damage: 2 };
                case 6: return { crit: 1 };
                default: return {};
            }
        default:
            return {};
    }
}

function buildResultPayload(message, totals) {
    return {
        chatMessageId: message.id,
        authorId: message.author?.id ?? null,
        dice: totals.dice,
        totals: {
            protection: totals.protection,
            damage: totals.damage,
            crit: totals.crit,
            fumble: totals.fumble,
            multiplier: totals.multiplier * totals.multiplyFail
        }
    };
}

/**
 * Called from 1547core main.js during init. Registers the 10 custom dice
 * terms with CONFIG.Dice and exposes the roll-result API on 1547core's
 * module.api. The diceSoNiceRollComplete / diceSoNiceReady hooks below
 * register at module-import time (which happens during 1547core's init).
 *
 * Flag namespace stays as "dice1547" so old chat messages keep their
 * recorded roll results.
 */
export function register1547Dice() {
    CONFIG.Dice.terms["a"] = DieArmor;
    CONFIG.Dice.terms["b"] = DieBalanced;
    CONFIG.Dice.terms["c"] = DieControl;
    CONFIG.Dice.terms["e"] = DieEvade;
    CONFIG.Dice.terms["g"] = DieFinesse;
    CONFIG.Dice.terms["h"] = DieHeavy;
    CONFIG.Dice.terms["l"] = DieLethality;
    CONFIG.Dice.terms["x"] = DieMultiplier;
    CONFIG.Dice.terms["p"] = DiePenetration;
    CONFIG.Dice.terms["r"] = DieRisk;

    const coreModule = game.modules.get("1547core");
    if (coreModule) {
        coreModule.api = coreModule.api ?? {};
        coreModule.api.getRollResult = (messageOrId) => {
            const message = typeof messageOrId === "string" ? game.messages.get(messageOrId) : messageOrId;
            // Read only the active scope — getFlag on the inactive legacy
            // "dice1547" scope logs a "scope not valid" warning on every poll.
            return message?.getFlag(FLAG_SCOPE, "rollResult") ?? null;
        };
        // Totals straight from an evaluated Roll (or array), so callers don't
        // depend on the Dice So Nice completion hook.
        coreModule.api.computeRollTotals = (rolls) => computeDice1547Totals(Array.isArray(rolls) ? rolls : [rolls]);
    }
}

// Accumulate 1547 dice outcomes from evaluated Roll objects. Shared by the Dice
// So Nice completion hook (flag + result card) and computeDice1547Totals, so
// combat resolution can read totals at roll time without waiting on the 3D
// animation hook to fire (which it may not, breaking the attack/defense rolls).
function accumulateDice1547Totals(rolls) {
        let protection = 0;
        let damage = 0;
        let fumble = 0;
        let crit = 0;
        let multiply = 1;
        let multiplyFail = 1;
        const diceResults = [];
        let dice1547Roll = false;
        (rolls ?? []).forEach(roll => {
            (roll?.dice ?? []).forEach(dice => {
                const dieType = getDieType(dice);
                if (!dieType) return;

                dice1547Roll = true;
                const faces = dice.results.map(res => ({
                    result: res.result,
                    active: res.active,
                    discarded: res.discarded,
                    exploded: res.exploded,
                    rerolled: res.rerolled,
                    counted: res.counted,
                    totals: getFaceTotals(dieType, res.result)
                }));

                diceResults.push({
                    type: dieType,
                    formula: dice.expression ?? `${dice.number ?? faces.length}d${dice.faces}`,
                    number: dice.number ?? faces.length,
                    faces
                });

                if (dice instanceof DieArmor){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                fumble++;
                                break;
                            case 2:
                                break;
                            case 3:
                                protection++;
                                break;
                            case 4:
                                protection+=2;
                                break;  
                            case 5:
                                protection+=4;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if (dice instanceof DieBalanced){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                fumble++;
                                break;
                            case 2:
                                break;
                            case 3:
                                damage++;
                                break;
                            case 4:
                                damage++;
                                break;  
                            case 5:
                                damage+=2;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if (dice instanceof DieControl){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                fumble++;
                                break;
                            case 2:
                                break;
                            case 3:
                                break;
                            case 4:
                                damage++;
                                break;  
                            case 5:
                                crit++;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if (dice instanceof DieEvade){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                fumble++;
                                break;
                            case 2:
                                break;
                            case 3:
                                protection++;
                                break;
                            case 4:
                                protection+=2;
                                break;  
                            case 5:
                                crit++;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if (dice instanceof DieHeavy){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                fumble++;
                                break;
                            case 2:
                                fumble++;
                                break;
                            case 3:
                                damage++;
                                break;
                            case 4:
                                damage+=2;
                                break;  
                            case 5:
                                damage+=4;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if (dice instanceof DieFinesse){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                break;
                            case 2:
                                break;
                            case 3:
                                damage++;
                                break;
                            case 4:
                                damage++;
                                break;
                            case 5:
                                crit++;
                                break;
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if (dice instanceof DieLethality){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                fumble++;
                                break;
                            case 2:
                                fumble++;
                                break;
                            case 3:
                                damage+=2;
                                break;
                            case 4:
                                damage+=3;
                                break;  
                            case 5:
                                damage+=5;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if(dice instanceof DieMultiplier){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                multiplyFail = 0;
                                break;
                            case 2:
                                break;
                            case 3:
                                break;
                            case 4:
                                multiply++;
                                break;  
                            case 5:
                                multiply++;
                                break;                     
                            case 6:
                                multiply+=2;
                                break;
                        }
                    });
                }
                if (dice instanceof DiePenetration){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                fumble++;
                                break;
                            case 2:
                                break;
                            case 3:
                                damage++;
                                break;
                            case 4:
                                damage++;
                                break;  
                            case 5:
                                damage+=3;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
                if (dice instanceof DieRisk){
                    dice.results.forEach(res => {
                        switch(res.result){
                            case 1:
                                multiplyFail = 0;
                                break;
                            case 2:
                                fumble++;
                                break;
                            case 3:
                                fumble++;
                                break;
                            case 4:
                                break;  
                            case 5:
                                damage+=2;
                                break;                     
                            case 6:
                                crit++;
                                break;
                        }
                    });
                }
            });
        });
        return { protection, damage, fumble, crit, multiply, multiplyFail, diceResults, dice1547Roll };
}

// Totals in getRollResult().totals shape, computed directly from evaluated rolls
// (Dice So Nice independent). Returns null for a roll with no 1547 dice.
export function computeDice1547Totals(rolls) {
    const acc = accumulateDice1547Totals(rolls);
    if (!acc.dice1547Roll) return null;
    return {
        protection: acc.protection,
        damage: acc.damage,
        crit: acc.crit,
        fumble: acc.fumble,
        multiplier: acc.multiply * acc.multiplyFail,
    };
}

Hooks.on('diceSoNiceRollComplete', async (chatMessageID) => {
    const message = game.messages.get(chatMessageID);
    if (!message?.isAuthor) return;
    const acc = accumulateDice1547Totals(message.rolls);
    if (!acc.dice1547Roll) return;
    const resultPayload = buildResultPayload(message, {
        protection: acc.protection,
        damage: acc.damage,
        crit: acc.crit,
        fumble: acc.fumble,
        multiplier: acc.multiply,
        multiplyFail: acc.multiplyFail,
        dice: acc.diceResults,
    });
    try {
        await message.setFlag(FLAG_SCOPE, "rollResult", resultPayload);
    } catch (err) {
        console.warn("1547core | could not store dice roll result flag", err);
    }
    Hooks.callAll(`${MODULE_ID}RollResult`, resultPayload, message);
    ChatMessage.create({
        content: `<b>Protection:</b> ${acc.protection}<br><b>Damage:</b> ${acc.damage}<br><b>Critical:</b> ${acc.crit}<br><b>Fumble:</b> ${acc.fumble}<br><b>Multiplier:</b> ${acc.multiply * acc.multiplyFail}<br>`,
        author: message.author,
        blind: message.blind
    });
});

let diceSoNicePresetsApplied = false;
function applyDiceSoNicePresets(dice3d) {
    if (diceSoNicePresetsApplied || !dice3d) return;
    diceSoNicePresetsApplied = true;
    const system = new DiceSystem("dice1547", "dice1547", "dice1547", "default");
    dice3d.addSystem(system);
    dice3d.addDicePreset({
      type:"db",
      labels:[ 
        'modules/1547core/images/dice/fumble_balanced_bg.png', 
        'modules/1547core/images/dice/blank_balanced_bg.png', 
        'modules/1547core/images/dice/d1_balanced_bg.png',
		'modules/1547core/images/dice/d1_balanced_bg.png',
        'modules/1547core/images/dice/d2_balanced_bg.png',
        'modules/1547core/images/dice/crit_balanced_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/balanced_bump.png', 
        'modules/1547core/images/dice/balanced_bump.png',
        'modules/1547core/images/dice/balanced_bump.png',
        'modules/1547core/images/dice/balanced_bump.png',
        'modules/1547core/images/dice/balanced_bump.png',
		'modules/1547core/images/dice/balanced_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"da",
      labels:[
        'modules/1547core/images/dice/fumble_armor_bg.png',
        'modules/1547core/images/dice/blank_armor_bg.png',
        'modules/1547core/images/dice/p1_armor_bg.png',
		'modules/1547core/images/dice/p2_armor_bg.png',
        'modules/1547core/images/dice/p4_armor_bg.png',
        'modules/1547core/images/dice/crit_armor_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/armor_bump.png', 
        'modules/1547core/images/dice/armor_bump.png',
        'modules/1547core/images/dice/armor_bump.png',
        'modules/1547core/images/dice/armor_bump.png',
        'modules/1547core/images/dice/armor_bump.png',
		'modules/1547core/images/dice/armor_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"dc",
      labels:[
        'modules/1547core/images/dice/fumble_control_bg.png',
        'modules/1547core/images/dice/blank_control_bg.png',
        'modules/1547core/images/dice/blank_control_bg.png',
		'modules/1547core/images/dice/d1_control_bg.png',
        'modules/1547core/images/dice/crit_control_bg.png',
        'modules/1547core/images/dice/crit_control_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/control_bump.png', 
        'modules/1547core/images/dice/control_bump.png',
        'modules/1547core/images/dice/control_bump.png',
        'modules/1547core/images/dice/control_bump.png',
        'modules/1547core/images/dice/control_bump.png',
		'modules/1547core/images/dice/control_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"de",
      labels:[
        'modules/1547core/images/dice/fumble_evade_bg.png',
        'modules/1547core/images/dice/blank_evade_bg.png',
        'modules/1547core/images/dice/p1_evade_bg.png',
		'modules/1547core/images/dice/p2_evade_bg.png',
        'modules/1547core/images/dice/crit_evade_bg.png',
        'modules/1547core/images/dice/crit_evade_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/evade_bump.png', 
        'modules/1547core/images/dice/evade_bump.png',
        'modules/1547core/images/dice/evade_bump.png',
        'modules/1547core/images/dice/evade_bump.png',
        'modules/1547core/images/dice/evade_bump.png',
		'modules/1547core/images/dice/evade_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"dg",
      labels:[
        'modules/1547core/images/dice/blank_finesse_bg.png',
        'modules/1547core/images/dice/blank_finesse_bg.png',
        'modules/1547core/images/dice/d1_finesse_bg.png',
		'modules/1547core/images/dice/d1_finesse_bg.png',
        'modules/1547core/images/dice/crit_finesse_bg.png',
        'modules/1547core/images/dice/crit_finesse_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/finesse_bump.png', 
        'modules/1547core/images/dice/finesse_bump.png',
        'modules/1547core/images/dice/finesse_bump.png',
        'modules/1547core/images/dice/finesse_bump.png',
        'modules/1547core/images/dice/finesse_bump.png',
		'modules/1547core/images/dice/finesse_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"dh",
      labels:[
        'modules/1547core/images/dice/fumble_heavy_bg.png',
        'modules/1547core/images/dice/fumble_heavy_bg.png',
        'modules/1547core/images/dice/d1_heavy_bg.png',
		'modules/1547core/images/dice/d2_heavy_bg.png',
        'modules/1547core/images/dice/d4_heavy_bg.png',
        'modules/1547core/images/dice/crit_heavy_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/heavy_bump.png', 
        'modules/1547core/images/dice/heavy_bump.png',
        'modules/1547core/images/dice/heavy_bump.png',
        'modules/1547core/images/dice/heavy_bump.png',
        'modules/1547core/images/dice/heavy_bump.png',
		'modules/1547core/images/dice/heavy_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"dx",
      labels:[
        'modules/1547core/images/dice/0x_multiply_bg.png', 
        'modules/1547core/images/dice/blank_multiply_bg.png',
        'modules/1547core/images/dice/blank_multiply_bg.png',
		'modules/1547core/images/dice/2x_multiply_bg.png',
        'modules/1547core/images/dice/2x_multiply_bg.png',
        'modules/1547core/images/dice/3x_multiply_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/multiply_bump.png',
        'modules/1547core/images/dice/multiply_bump.png',
        'modules/1547core/images/dice/multiply_bump.png',
        'modules/1547core/images/dice/multiply_bump.png',
        'modules/1547core/images/dice/multiply_bump.png',
		'modules/1547core/images/dice/multiply_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"dl",
      labels:[
        'modules/1547core/images/dice/fumble_lethal_bg.png',
        'modules/1547core/images/dice/fumble_lethal_bg.png',
        'modules/1547core/images/dice/d2_lethal_bg.png',
		'modules/1547core/images/dice/d3_lethal_bg.png',
        'modules/1547core/images/dice/d5_lethal_bg.png',
        'modules/1547core/images/dice/crit_lethal_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/lethal_bump.png', 
        'modules/1547core/images/dice/lethal_bump.png',
        'modules/1547core/images/dice/lethal_bump.png',
        'modules/1547core/images/dice/lethal_bump.png',
        'modules/1547core/images/dice/lethal_bump.png',
		'modules/1547core/images/dice/lethal_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"dp",
      labels:[
        'modules/1547core/images/dice/fumble_penetration_bg.png',
        'modules/1547core/images/dice/blank_penetration_bg.png',
        'modules/1547core/images/dice/d1_penetration_bg.png',
		'modules/1547core/images/dice/d1_penetration_bg.png',
        'modules/1547core/images/dice/d3_penetration_bg.png',
        'modules/1547core/images/dice/crit_penetration_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/penetration_bump.png',
        'modules/1547core/images/dice/penetration_bump.png',
        'modules/1547core/images/dice/penetration_bump.png',
        'modules/1547core/images/dice/penetration_bump.png',
        'modules/1547core/images/dice/penetration_bump.png',
		'modules/1547core/images/dice/penetration_bump.png'
      ],
      system:"dice1547"
    });
    dice3d.addDicePreset({
      type:"dr",
      labels:[
        'modules/1547core/images/dice/0x_risk_bg.png',
        'modules/1547core/images/dice/fumble_risk_bg.png',
        'modules/1547core/images/dice/fumble_risk_bg.png',
		'modules/1547core/images/dice/blank_risk_bg.png',
        'modules/1547core/images/dice/d2_risk_bg.png',
        'modules/1547core/images/dice/crit_risk_bg.png'
      ],
      bumpMaps:[
        'modules/1547core/images/dice/risk_bump.png', 
        'modules/1547core/images/dice/risk_bump.png',
        'modules/1547core/images/dice/risk_bump.png',
        'modules/1547core/images/dice/risk_bump.png',
        'modules/1547core/images/dice/risk_bump.png',
		'modules/1547core/images/dice/risk_bump.png'
      ],
      system:"dice1547"
    });
}

// Register the dice geometry when Dice So Nice signals readiness, AND apply
// immediately if it is already ready — this module is imported dynamically, so
// the import can resolve *after* diceSoNiceReady has fired (notably on a
// player's client), which previously left the custom dice with no geometry
// (DiceBox.getVectors → "reading 'shape' of null"). The applied-flag keeps it
// idempotent if both paths run.
Hooks.once('diceSoNiceReady', (dice3d) => applyDiceSoNicePresets(dice3d));
if (globalThis.game?.dice3d) applyDiceSoNicePresets(globalThis.game.dice3d);
