export class DieMultiplier extends Die {
    constructor(termData) {
        termData.faces=6;
        super(termData);
    }

    /* -------------------------------------------- */

    /** @override */
    static DENOMINATION = "x";

    /** @override */
    get total(){
        return this.results.length;
    }

    /* -------------------------------------------- */

    /** @override */
    getResultLabel(result) {
        return {
			"1": '<img src="modules/1547core/images/dice/0x_chat.png" />',
            "2": '<img src="modules/1547core/images/dice/blank_chat.png" />',
            "3": '<img src="modules/1547core/images/dice/blank_chat.png" />',
            "4": '<img src="modules/1547core/images/dice/2x_chat.png" />',
			"5": '<img src="modules/1547core/images/dice/2x_chat.png" />',			
            "6": '<img src="modules/1547core/images/dice/3x_chat.png" />'
        }[result.result];
    }
}
