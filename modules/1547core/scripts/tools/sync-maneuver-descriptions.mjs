import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "modules/1547core/foundry/Templates/maneuvers.json");

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function formatList(values) {
    const parts = (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function humanizeIdentifier(value) {
    return String(value ?? "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function humanizeCostType(costType) {
    const map = {
        CorePoints: "one Core point",
        CriticalPoints: "one Critical point"
    };
    return map[costType] ?? "";
}

function formatCost(maneuver) {
    if (!maneuver?.CostType || maneuver.CostType === "null" || Number(maneuver.CostAmount ?? 0) <= 0) return "";
    const base = humanizeCostType(maneuver.CostType);
    const amount = Number(maneuver.CostAmount ?? 0);
    if (!base) return "";
    if (amount === 1) return `at the cost of ${base}`;
    return `at the cost of ${amount} ${humanizeIdentifier(maneuver.CostType.replace(/Points$/, " points"))}`;
}

function formatTrigger(maneuver) {
    const trigger = String(maneuver?.triggerType ?? "").trim();
    const usage = String(maneuver?.type ?? "").trim();
    if (trigger === "attack-declared" && usage === "reaction") {
        return "It is used as a reaction when attacked.";
    }
    const map = {
        "attack-declared": "It is declared before an attack is resolved.",
        "movement-declared": "It is declared before movement is resolved.",
        "move-declared": "It is declared before movement is resolved.",
        "attack-dealt-0-damage": "It is used as a reaction after an attack fails to deal damage.",
        "attack-declared-reaction": "It is used as a reaction when attacked.",
        "damage-taken": "It is used as a reaction after taking damage.",
        "post-attack": "It is spent after a successful attack in the post-maneuver window.",
        "full-turn-activation": "It is activated as a full-turn maneuver instead of making a normal attack.",
        "threat-zone-entered": "It is used as a reaction when a target crosses your threat zone.",
        "threat-zone-left": "It is used as a reaction when a target leaves your threat zone.",
        "charge-declared": "It is used as a reaction when a charge is declared.",
        "hook-applied": "It is used as a reaction when a hooking effect is applied.",
        "locked": "It is used as a reaction while you are locked.",
        "choking-hold": "It is used as a reaction while you are trapped in a choking hold.",
        "escape": "It is used to break free of a condition that holds you.",
        "escape-succeeded": "It triggers the instant you break free of a hold."
    };
    if (map[trigger]) return map[trigger];
    if (usage === "pre") return "It is declared before the action it modifies is resolved.";
    if (usage === "reaction") return "It is used as a reaction when its trigger window opens.";
    if (usage === "post") return "It is spent after an attack has resolved.";
    if (usage === "full-turn") return "It is activated on your full turn instead of an ordinary attack sequence.";
    return "It is used in the moment its combat window allows.";
}

function firstSentenceFromRequirements(requirements) {
    const skill = String(requirements?.skill ?? "").trim();
    const text = String(requirements?.text ?? "").trim();
    const weaponTraits = formatList((requirements?.requiredWeaponTraits ?? []).map(humanizeIdentifier));
    const weaponGroups = formatList((requirements?.requiredWeaponGroups ?? []).map(humanizeIdentifier));
    const parts = [];
    if (skill) parts.push(skill);
    if (weaponTraits) parts.push(`a weapon with ${weaponTraits}`);
    if (weaponGroups) parts.push(`the ${weaponGroups} groups`);
    if (text) parts.push(text.replace(/\.$/, ""));
    return parts.join("; ");
}

function describeEffect(maneuver) {
    const effect = maneuver?.effectData ?? {};
    const lines = [];

    if (effect.addMainDice) lines.push(`adds ${effect.addMainDice} main die${effect.addMainDice === 1 ? "" : "s"}`);
    if (effect.addArmorDice) lines.push(`adds ${effect.addArmorDice} armor die${effect.addArmorDice === 1 ? "" : "s"} to the defense`);
    if (effect.addMultiplierDice) lines.push(`adds ${effect.addMultiplierDice} multiplier die${effect.addMultiplierDice === 1 ? "" : "s"}`);
    if (effect.addRiskDice) lines.push(`adds ${effect.addRiskDice} risk die${effect.addRiskDice === 1 ? "" : "s"}`);
    if (effect.addDisadvantage) lines.push(`adds ${effect.addDisadvantage} disadvantage`);
    if (effect.addMoveSquares) lines.push(`adds ${effect.addMoveSquares} squares of movement`);
    if (effect.reduceDamageTaken) lines.push(`reduces damage taken by ${effect.reduceDamageTaken}`);
    if (effect.reduceReloadTime) lines.push(`reduces reload time by ${effect.reduceReloadTime}`);
    if (effect.recoverSpentStatPoints) lines.push(`recovers ${effect.recoverSpentStatPoints} spent stat point${effect.recoverSpentStatPoints === 1 ? "" : "s"}`);
    if (effect.clearAllRiskPoints) lines.push("clears all risk points");
    if (effect.removeIncomingMultiplierDice) lines.push(`removes ${effect.removeIncomingMultiplierDice} incoming multiplier die${effect.removeIncomingMultiplierDice === 1 ? "" : "s"}`);
    if (effect.cancelIncomingMultiplierDice) lines.push(`cancels ${effect.cancelIncomingMultiplierDice} incoming multiplier die${effect.cancelIncomingMultiplierDice === 1 ? "" : "s"}`);
    if (effect.removeAllIncomingMultiplierDice) lines.push("removes all incoming multiplier dice");
    if (effect.ignoreHighestArmorDie) lines.push("ignores the target's highest armor die");
    if (effect.convertCriticalPointsToDamage) lines.push(`converts ${effect.convertCriticalPointsToDamage} critical point${effect.convertCriticalPointsToDamage === 1 ? "" : "s"} into damage`);
    if (effect.addDamage) lines.push(`adds ${effect.addDamage} extra damage`);
    if (effect.addDamagePerDefenderResult) lines.push(`adds damage based on the defender's ${String(effect.addDamagePerDefenderResult).replace(/\s+/g, " ").trim()} result`);
    if (effect.disarmWeapon) lines.push("can disarm the target's weapon");
    if (effect.createFreeSafeAttack || effect.createFreeSafeCounterattack || effect.createSecondSafeAttack) lines.push("creates a follow-up safe attack");
    if (effect.grantAdvantageNextLegalAttack) lines.push("grants advantage on the next legal attack");
    if (effect.grantDefenseAdvantage) lines.push(`grants ${effect.grantDefenseAdvantage} defense advantage`);
    if (effect.addAdvantageNextEscapeRoll) lines.push(`adds ${effect.addAdvantageNextEscapeRoll} advantage to the next escape roll`);
    if (effect.grantAdvantageWithinSquares) lines.push(`grants nearby allies advantage within ${effect.grantAdvantageWithinSquares} squares`);
    if (effect.formationAdvantagePerParticipant) lines.push(`builds advantage from each participating ally in formation`);
    if (effect.allowFirearmAtMelee) lines.push("allows a firearm attack at melee range");
    if (effect.ignoreMovementTriggeredReactions) lines.push("ignores movement-triggered reactions");
    if (effect.ignoreOpportunityStrike) lines.push("ignores opportunity strikes during the move");
    if (effect.ifDealsDamageMoveTowardTarget) lines.push(`moves you ${effect.ifDealsDamageMoveTowardTarget} square${effect.ifDealsDamageMoveTowardTarget === 1 ? "" : "s"} toward the target if damage is dealt`);
    if (effect.targetCannotUse) lines.push(`prevents the target from using ${effect.targetCannotUse}`);
    if (effect.readyEquippedSidearm) lines.push("readies an equipped sidearm for immediate use");
    if (effect.usableInCurrentAction) lines.push("lets that sidearm be used in the current action");
    if (effect.rotateTargetFacingSteps) lines.push(`rotates the target ${effect.rotateTargetFacingSteps} facing step${effect.rotateTargetFacingSteps === 1 ? "" : "s"}`);
    if (effect.pushTargetSquares) lines.push(`pushes the target ${effect.pushTargetSquares} square${effect.pushTargetSquares === 1 ? "" : "s"}`);
    if (effect.ifAttackDealsDamagePushTargetSquares) lines.push(`pushes the target ${effect.ifAttackDealsDamagePushTargetSquares} square${effect.ifAttackDealsDamagePushTargetSquares === 1 ? "" : "s"} if the attack deals damage`);
    if (effect.placeTargetAdjacent) lines.push("places the target adjacent to you");
    if (effect.stopEnteringActorInEnteredSquare) lines.push("stops an entering target in the entered square");
    if (effect.placeDroppedWeaponSquares) lines.push(`throws a dropped weapon up to ${effect.placeDroppedWeaponSquares} square${effect.placeDroppedWeaponSquares === 1 ? "" : "s"} away`);
    if (effect.ifAttackDealsDamageApplyCondition) lines.push(`applies ${humanizeIdentifier(effect.ifAttackDealsDamageApplyCondition)} if the attack deals damage`);
    if (effect.applyCondition) lines.push(`applies the ${humanizeIdentifier(effect.applyCondition)} condition`);
    if (effect.upgradeCondition) lines.push(`upgrades the target's condition to ${humanizeIdentifier(effect.upgradeCondition)}`);
    if (effect.swallowTarget) lines.push("can swallow the target whole");
    if (effect.ongoingDamagePerTurn) lines.push(`starts ongoing damage of ${effect.ongoingDamagePerTurn} per turn`);
    if (effect.areaAttack) lines.push(`strikes across the ${humanizeIdentifier(effect.areaAttack)}`);
    if (effect.passThroughSmallerCreatures) lines.push("lets the attacker pass through smaller creatures");
    if (effect.applyNaturalWeaponDamageToEach) lines.push("applies natural-weapon damage to each affected creature");
    if (effect.useMaxRange) lines.push("uses the weapon's maximum range");
    if (effect.requiresGroupAttack) lines.push("requires a coordinated group attack");
    if (effect.sharedAttackerRoll) lines.push("uses a shared attacker roll");
    if (effect.eachTargetDefendsSeparately) lines.push("still makes each target defend separately");
    if (effect.createsPersistentEffect) lines.push(`creates the ${humanizeIdentifier(effect.createsPersistentEffect)} effect`);
    if (effect.createsBattlefieldEffect) lines.push(`creates the ${humanizeIdentifier(effect.createsBattlefieldEffect)} battlefield effect`);
    if (effect.doubleMove) lines.push("doubles your movement");
    if (effect.recoverCorePoints) lines.push(`recovers ${effect.recoverCorePoints} Core point${effect.recoverCorePoints === 1 ? "" : "s"}`);
    if (effect.addDefenseMultiplierDice) lines.push(`adds ${effect.addDefenseMultiplierDice} multiplier die${effect.addDefenseMultiplierDice === 1 ? "" : "s"} to the defense`);
    if (effect.addArmorDiceToAllyDefense) lines.push(`adds ${effect.addArmorDiceToAllyDefense} armor die${effect.addArmorDiceToAllyDefense === 1 ? "" : "s"} to an adjacent ally's defense`);
    if (effect.addArmorDiceIfAdjacentShieldWallAlly) lines.push(`adds ${effect.addArmorDiceIfAdjacentShieldWallAlly} armor die when an adjacent ally also holds Shield Wall`);
    if (effect.advantageOnNextAttack) lines.push("grants advantage on your next attack");
    if (effect.indirect) lines.push("arcs over intervening cover to strike indirectly");
    if (effect.opposedCheck) lines.push(`is resolved as an opposed ${humanizeIdentifier(effect.opposedCheck)} check`);
    if (effect.removesCondition) {
        const conds = (Array.isArray(effect.removesCondition) ? effect.removesCondition : [effect.removesCondition]).map(humanizeIdentifier);
        const list = formatList(conds);
        lines.push(effect.removesAllHeld ? `removes every one of ${list} you are under` : `removes the ${list} condition`);
    }

    if (lines.length === 0) {
        return "In play, it creates a tactical advantage or restriction that should be resolved according to its timing, tags, and listed requirements.";
    }

    const body = lines.length === 1 ? lines[0] : `${lines.slice(0, -1).join(", ")}, and ${lines.at(-1)}`;
    return `In play, it ${body}.`;
}

function describeIdentity(maneuver) {
    const name = String(maneuver?.name ?? "").trim();
    const custom = {
        "Act Of Faith": "A devotional exertion that turns conviction into temporary martial certainty.",
        "Act Of Heroism": "A self-committing surge of courage that drives an attack harder at the cost of safety.",
        "Act Of Inspiration": "A spoken or visible rallying effort that steadies an ally and sharpens their performance.",
        "Act Of Precision": "A careful expenditure of focus that turns a ranged strike toward exact placement.",
        "Act Of Speed": "A burst of quickness used to cover more ground before the enemy can answer.",
        "Act Of Strength": "A forceful commitment that turns bodily power directly into a heavier melee attack.",
        "Act Of Toughness": "A bodily hardening response that lets you endure a blow that would otherwise bite deeper.",
        "Aim": "A full-turn setup spent steadying the shot instead of firing at once.",
        "Core Attack": "A raw exertion of effort that drives any attack harder.",
        "Core Speed": "A burst of raw effort that carries you twice as far.",
        "Core Escape": "A surge of raw effort that wrenches you free of every hold at once.",
        "Core Toughness": "A bracing of the body that lets you shrug off part of a blow.",
        "Core Defense": "A committed defensive effort that hardens your guard against a blow.",
        "Core Restore": "A moment seized after a telling blow to recover spent effort.",
        "Quick Draw": "A snap draw that brings a sidearm to bear in the same breath as the attack.",
        "Overwatch": "A held ready stance that watches a field of fire for a target to punish.",
        "Arced Shot": "A lobbed, indirect shot that arcs over anything in the way to fall on the target.",
        "Break Grapple": "A twisting effort to slip free of a grapple.",
        "Slip The Lock": "A forceful wrench to free a limb from a joint-lock.",
        "Break The Choke": "A desperate wrench to tear a choking hold off your throat.",
        "Stand Up": "A quick rise back to your feet from prone.",
        "All-in": "A reckless commitment that drives a heavy attack harder by accepting greater danger in return.",
        "Assassinate": "A hidden killing stroke meant to end the fight before the target can properly react.",
        "Bind": "A strong parrying catch that ties up the enemy's attack and strips its extra force away.",
        "Brace Firearm": "A prepared firing stance that settles a braced firearm for a steadier and more punishing shot.",
        "Break Armor": "A punishing follow-through aimed at exploiting armor strain after a solid hit.",
        "Bull Charge": "A rushing impact that turns momentum into a heavier unmounted melee attack.",
        "Catch Breath": "A moment of recovery spent regaining composure instead of pressing the fight.",
        "Charge": "A mounted driving attack that turns speed and weight into immediate offensive force.",
        "Choke": "A tightening control hold that shifts a lock into a suffocating restraint.",
        "Counter Attack": "A sharp defensive answer that prepares an immediate safe return strike after the threat resolves.",
        "Desperate Defense": "A last-ditch defense that throws caution aside just to spoil the worst of an incoming blow.",
        "Disarm": "A practiced weapon-stripping stunt that sends the enemy's armament flying free.",
        "Disengage": "A careful withdrawal that breaks contact without inviting the usual reaction strike.",
        "Evade": "A sudden bodily avoidance that tries to slip the attack rather than meet it with steel or shield.",
        "Feint": "A quick false opening used to draw a bad response and create a better line for the true attack.",
        "Formation": "A disciplined group attack in which nearby fighters support one another's line and pressure.",
        "Hook": "A controlling hooked follow-up meant to drag, trip, pull, or unseat the target after a telling hit.",
        "Lock": "A controlling hold that ties up the target's body and leaves them easier to dominate.",
        "Lock And Strike": "A brutal close-control sequence that turns an existing lock into a heavier strike and follow-up.",
        "Opportunity Strike": "A fast answer against movement through your reach, meant to punish careless steps.",
        "Parry": "A committed weapon defense that turns an incoming blow aside rather than simply enduring it.",
        "Point Blank": "A dangerous close-range firearm technique used when there is no time to yield space first.",
        "Press": "A forward-driving attack that keeps pressure on a hurt or shaken target and crowds out their escape.",
        "Quick Aim": "A shortened aiming action that steals a little precision without surrendering the whole attack.",
        "Quick Brace Firearm": "A hurried bracing action that settles a firearm enough to gain some of the benefit of full preparation.",
        "Quick Reload": "A hurried reload performed under pressure to keep a missile weapon in the fight.",
        "Rally": "A battlefield call that steadies nearby allies and sharpens their readiness for the exchange.",
        "Receive Charge": "A disciplined answer to an incoming charge, turning the enemy's rush into your own prepared opening.",
        "Redouble": "A fast follow-through that converts momentum or opening into another safe attack.",
        "Reload": "A full-turn action spent bringing a reloading weapon back into fighting condition.",
        "Resist Hooking": "A forceful reaction that resists being tripped, pulled, or unhorsed by a hooking attack.",
        "Riposte": "A trained return strike launched the moment an enemy's failed attack leaves them exposed.",
        "Sap": "A hidden nonlethal strike aimed at dropping a target before they can properly answer.",
        "Shield": "A shield-led defense that absorbs the force of an incoming attack behind solid coverage.",
        "Shield Wall": "A shield-based group defense that strengthens the line when fighters hold together.",
        "Suppressing Fire": "A full-turn hail of shots used to pin enemies down and restrict their movement through a threatened space.",
        "Volley Fire": "A coordinated group salvo that trades individual freedom for heavier disciplined ranged pressure.",
        "Throw": "A grappling finish that hurls the target down and leaves them prone at your feet.",
        "Provoke": "A taunting or commanding gesture meant to lure the enemy into a riskier next attack.",
        "Turn": "A positional follow-up that twists the target and spoils their facing after contact.",
        "Convert": "A direct conversion of critical advantage into immediate extra harm.",
        "Half-Sword": "A close-in rigid-blade technique that sacrifices ease to exploit gaps in armor.",
        "Push Of Pike": "A polearm follow-up that shoves the target backward under united reach and pressure.",
        "Flank": "A positional attack that turns divided pressure on the target into a sharper melee opening.",
        "Hold At Bay": "A long-weapon stop that arrests an enemy the moment they push into your reach.",
        "Guard Ally": "A protective intervention that lets you cover an adjacent ally with your own shield and presence.",
        "Advance Under Guard": "A guarded advance that trades stamina for safer forward movement behind shield work.",
        "Grapple Break": "A violent effort to wrench free from a lock or choking hold and possibly answer in the same beat.",
        "Weak Spot": "A precise attack that seeks a gap, seam, or exposed place in otherwise reliable armor.",
        "Shield Bash": "A shield-led strike meant to stagger and drive the target backward if it lands cleanly.",
        "Pounce": "A leaping natural-weapon attack that uses movement to bowl the prey down under sudden force.",
        "Trample": "A massive rushing movement that batters through smaller creatures and throws them down.",
        "Tail Sweep": "A broad tail-driven attack that clears space behind the creature with brute control.",
        "Constrict": "A crushing coil or binding grip that turns a hit into an ongoing grapple and squeeze.",
        "Swallow Whole": "A monstrous finishing attack that devours a much smaller or already controlled target.",
        "Wing Buffet": "A heavy wing-driven strike that knocks a target back or down under forceful air and impact."
    };
    return custom[name] ?? `A tactical maneuver called ${name} that shifts the immediate terms of the fight.`;
}

function buildDescription(maneuver) {
    const requirements = maneuver?.requirements ?? {};
    const identity = describeIdentity(maneuver);
    const trigger = formatTrigger(maneuver);
    const effect = describeEffect(maneuver);
    const extras = [];
    const requirementSummary = firstSentenceFromRequirements(requirements);
    const costSummary = formatCost(maneuver);
    if (requirementSummary) extras.push(`It requires ${requirementSummary}.`);
    if (costSummary) extras.push(`${costSummary.charAt(0).toUpperCase()}${costSummary.slice(1)}.`);
    return [identity, trigger, effect, ...extras].join(" ").replace(/\s+/g, " ").trim();
}

function main() {
    const maneuvers = readJson(SOURCE_PATH);
    const updated = maneuvers.map((maneuver) => ({
        ...maneuver,
        description: buildDescription(maneuver)
    }));
    if (process.argv.includes("--stdout")) {
        process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
        return;
    }
    writeJson(SOURCE_PATH, updated);
    console.log(`Updated ${updated.length} maneuver descriptions.`);
}

main();
