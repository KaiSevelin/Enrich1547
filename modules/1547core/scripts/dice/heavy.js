export class DieHeavy extends Die {
    constructor(termData) {
        termData.faces=6;
        super(termData);
    }

    /* -------------------------------------------- */

    /** @override */
    static DENOMINATION = "h";

    /** @override */
    get total(){
        return this.results.length;
    }

    /* -------------------------------------------- */

    /** @override */
    getResultLabel(result) {
        return {
			"1": '<img src="modules/1547core/images/dice/fumble_chat.png" />',
            "2": '<img src="modules/1547core/images/dice/fumble_chat.png" />',
            "3": '<img src="modules/1547core/images/dice/d1_chat.png" />',
            "4": '<img src="modules/1547core/images/dice/d2_chat.png" />',
			"5": '<img src="modules/1547core/images/dice/d4_chat.png" />',			
            "6": '<img src="modules/1547core/images/dice/crit_chat.png" />'
        }[result.result];
    }
}