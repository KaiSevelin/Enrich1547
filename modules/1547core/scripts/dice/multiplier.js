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
			"1": '<img src="modules/dice1547/images/0x_chat.png" />',
            "2": '<img src="modules/dice1547/images/blank_chat.png" />',
            "3": '<img src="modules/dice1547/images/blank_chat.png" />',
            "4": '<img src="modules/dice1547/images/2x_chat.png" />',
			"5": '<img src="modules/dice1547/images/2x_chat.png" />',			
            "6": '<img src="modules/dice1547/images/3x_chat.png" />'
        }[result.result];
    }
}
