export class DiePenetration extends Die {
    constructor(termData) {
        termData.faces=6;
        super(termData);
    }

    /* -------------------------------------------- */

    /** @override */
    static DENOMINATION = "p";

    /** @override */
    get total(){
        return this.results.length;
    }

    /* -------------------------------------------- */

    /** @override */
    getResultLabel(result) {
        return {
			"1": '<img src="modules/1547core/images/dice/fumble_chat.png" />',
            "2": '<img src="modules/1547core/images/dice/blank_chat.png" />',
            "3": '<img src="modules/1547core/images/dice/d1_chat.png" />',
            "4": '<img src="modules/1547core/images/dice/d1_chat.png" />',
			"5": '<img src="modules/1547core/images/dice/d3_chat.png" />',			
            "6": '<img src="modules/1547core/images/dice/crit_chat.png" />'
        }[result.result];
    }
}