import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "modules/1547core/foundry/Templates/equipment.json");

const MUNDANE_CATEGORIES = new Set([
    "Amulets",
    "Clothing",
    "Containers",
    "Cooking",
    "Food and drink",
    "Health and hygien",
    "Jewelry",
    "Misc items",
    "Musical instruments",
    "Outdoors",
    "Potions",
    "Tools",
    "Writing"
]);

const DESCRIPTIONS = {
    "Boots": "A sturdy pair of boots meant for road, yard, and common outdoor wear. In play, they are dependable everyday footwear for travel, labor, and rough ground.",
    "Doublet": "A fitted outer garment worn through town, court, and respectable daily life. In play, it marks ordinary respectable dress rather than armor or field gear.",
    "Embroidered clothing": "Well-made clothing ornamented with stitched decorative work to show taste, wealth, or household standing. In play, it serves as dress of display rather than plain utility wear.",
    "Feathered hat": "A shaped hat dressed with feathers for fashion, rank display, or swaggering appearance. In play, it is notable headwear meant to be seen.",
    "Felt hat": "A practical hat of felt worn for common weather protection and everyday dress. In play, it is ordinary headwear suited to travel, work, and town use.",
    "Fur-lined mantle": "A heavy outer mantle lined for warmth against cold wind and winter weather. In play, it is strong cold-weather clothing rather than light travel wear.",
    "Gloves": "A pair of hand coverings used for warmth, cleanliness, or light protection in work and travel. In play, they are ordinary wear for comfort and handling rough material.",
    "Hose": "Close-fitting legwear worn beneath or with other clothing as standard everyday dress. In play, it is a common garment rather than protective equipment.",
    "Leather apron": "A tough apron worn over working clothes to shield them from dirt, sparks, grease, or scraping tools. In play, it marks practical labor and workshop use.",
    "Leather belt": "A simple belt for securing clothing and hanging small carried items at the waist. In play, it is ordinary support gear for dress and daily carry.",
    "Leather shoes": "A pair of common leather shoes suitable for indoor wear, streets, and fair weather. In play, they are standard everyday footwear rather than hard travel gear.",
    "Linen shirt": "A plain linen shirt worn next to the body as the ordinary base layer of dress. In play, it is a common undergarment and everyday garment.",
    "Oiled cloak": "A weather-treated cloak made to resist rain and keep off cold wet wind. In play, it is practical travel wear for bad weather.",
    "Wool cloak": "A heavy woolen cloak worn for warmth, layering, and common outdoor protection. In play, it is ordinary cold-weather outerwear.",
    "Wool tunic": "A serviceable wool tunic suited to daily wear across town, road, and household labor. In play, it is ordinary practical clothing.",
    "Backpack": "A sturdy carrying pack worn on the back, used to keep travel goods together and off the hands. In play, it is the standard container for hauling personal gear on the road.",
    "Barrel": "A large hooped wooden container built for storing and moving bulk goods, drink, or salted provisions. In play, it is a heavy storage container rather than something carried on the person.",
    "Basket": "A woven carrying basket used for gathering, market loads, and loose household goods. In play, it is a light open container for ordinary transport.",
    "Belt pouch": "A small pouch worn at the belt for coins, tokens, and hand-sized necessities. In play, it is the usual personal container for things that must stay close at hand.",
    "Chest": "A wooden chest used to store clothing, valuables, papers, or household goods under a solid lid. In play, it is a durable fixed container for keeping possessions together.",
    "Crate": "A rough wooden crate built for stacking, shipping, and storing hard goods in bulk. In play, it is a practical transport container rather than a secure stronghold for valuables.",
    "Leather pouch": "A soft leather pouch used to carry small everyday items, coin, herbs, or odds and ends. In play, it is a simple general-purpose small container.",
    "Quiver": "A carrying case for arrows or bolts worn for quick access in hunting or battle. In play, it is the standard container for ready missile ammunition.",
    "Satchel": "A shoulder-slung bag used for papers, tools, books, or mixed personal effects. In play, it is a versatile carried container for travel and work.",
    "Scroll case": "A narrow protective case for carrying rolled documents without crushing or weathering them. In play, it is the standard container for scrolls, writs, and other rolled papers.",
    "Strongbox": "A reinforced lockable box meant to hold coin, documents, or other goods worth protecting. In play, it is the secure container of this mundane set.",
    "Cooking pot": "A durable metal pot used for boiling food, heating liquids, and preparing common meals over a fire. In play, it serves wherever a camp or household needs practical cooking rather than fine table service.",
    "Cup": "A simple drinking cup used for water, ale, wine, or other common liquids at table or camp. In play, it is ordinary tableware.",
    "Cutlery set": "A personal eating set for cutting, serving, and handling food at table or on the road. In play, it is common mess and dining gear.",
    "Flask": "A small closable vessel used to carry drink, medicine, oil, or other measured liquid in hand-sized quantity. In play, it is a compact liquid container for travel and work.",
    "Frying pan": "A handled pan used for cooking directly over coals or open flame. In play, it supports practical frying and field cooking.",
    "Glass": "A drinking glass used for table service where refinement matters more than hard use. In play, it is fragile tableware rather than rugged camp gear.",
    "Mortar & pestle": "A grinding set used to crush, blend, and prepare herbs, powders, and other workable ingredients. In play, it is the standard hand tool for mixing and reducing materials.",
    "Tankard": "A sturdy handled drinking vessel for ale and other common table drink. In play, it is durable drinking ware suited to tavern, camp, or hall.",
    "Waterskin": "A flexible skin vessel used to carry water or other drink on the road. In play, it is the standard personal liquid store for travel.",
    "Wooden bowl": "A simple bowl for eating, mixing, or holding food in household or camp use. In play, it is plain everyday tableware.",
    "Ale": "A common fermented drink served for daily refreshment, meals, and tavern life. In play, it is ordinary drink rather than luxury stock.",
    "Bread loaf": "A loaf of everyday bread meant for common meals, road food, and household table use. In play, it is staple food.",
    "Cheese": "A preserved dairy food valued for keeping longer than fresh milk and traveling well with simple provisions. In play, it is common stored food.",
    "Dried meat": "Preserved meat kept for travel, storage, and meals when fresh butchery is not at hand. In play, it is durable ration food.",
    "Hardtack": "A hard baked ration biscuit made to endure storage and travel better than fresh bread. In play, it is dependable but plain journey food.",
    "Honey": "A sweet food and preservative used at table, in drink, and in practical preparation. In play, it is a valuable everyday ingredient rather than a luxury curiosity.",
    "Imported wine": "Wine brought from elsewhere and valued for quality, novelty, or social distinction. In play, it is finer table drink than common local stock.",
    "Local wine": "Wine made or traded within ordinary regional reach for table use and hospitality. In play, it is familiar everyday wine rather than prestige import.",
    "Salt": "A necessary mineral used for seasoning, curing, and preserving food. In play, it is a practical household supply with wide everyday use.",
    "Smoked fish": "Fish preserved by smoke for longer keeping and easier travel use than fresh catch. In play, it is durable provision food.",
    "Spices": "A mixed store of seasonings used to flavor food and improve cooking where means allow. In play, they are valued culinary goods rather than staple necessity.",
    "Bandages": "Cloth wrappings kept for binding wounds, stemming blood, and protecting injuries from dirt. In play, they are the basic consumable for immediate first aid and stabilizing hurt flesh.",
    "Comb": "A hand comb for grooming hair, clearing tangles, and keeping ordinary cleanliness of appearance. In play, it is a plain personal grooming item.",
    "Healing herbs": "A gathered store of practical herbs kept for common remedy, poultice, and household treatment. In play, they are ordinary medicinal supplies rather than formal alchemical mixtures.",
    "Herbal salve": "A prepared ointment of herbs and fat or wax used to soothe skin, minor hurts, or irritation. In play, it is a practical household remedy.",
    "Perfume": "A scented preparation used to sweeten clothing, skin, or personal presence. In play, it is a grooming and social luxury item.",
    "Razor": "A sharp grooming blade used for shaving beard, trimming hair, and careful bodily upkeep. In play, it is an ordinary personal or barbering tool.",
    "Sewing kit": "A small working set of needles, thread, and mending necessities kept for repair and stitching. In play, it is the standard kit for clothing or cloth fixes.",
    "Soap": "A cleaning block or paste used to wash skin, cloth, and common grime away. In play, it is a practical hygiene supply.",
    "Tooth powder": "A prepared cleaning powder used to scour the teeth and freshen the mouth. In play, it is a grooming aid rather than a curative remedy.",
    "Bronze brooch": "A simple brooch of bronze used to fasten clothing and add modest ornament to dress. In play, it is everyday jewelry with practical fastening use.",
    "Gemstone ring": "A ring set with a gemstone, worn for ornament, status, or sentimental value. In play, it is fine jewelry meant to be seen.",
    "Gold earring": "A gold earring worn as a visible sign of taste, means, or personal adornment. In play, it is valuable jewelry.",
    "Gold neck chain": "A worked gold chain worn around the neck as a clear display of wealth and ornament. In play, it is high-value jewelry.",
    "Gold ring": "A gold ring worn as adornment, signal of means, or personal keepsake. In play, it is valuable everyday jewelry.",
    "Guild ring": "A ring marking guild membership, trade standing, or recognized craft identity. In play, it carries social and professional meaning as well as ornament.",
    "Rosary beads": "A string of devotional beads used to count prayers and keep the mind to ordered devotion. In play, it is a common religious object with social and spiritual significance.",
    "Saint's medal": "A small devotional medal worn or carried in honor of a saint and for ordinary religious comfort. In play, it is a familiar religious token rather than a weapon or tool.",
    "Signet ring": "A ring bearing a personal or family device for sealing wax and marking identity. In play, it is jewelry with practical use in letters and authority.",
    "Silver earring": "A silver earring worn as ordinary personal adornment with some material value. In play, it is common fine jewelry.",
    "Silver neck chain": "A silver chain worn for ornament, gift value, or simple display of means. In play, it is moderate-value jewelry.",
    "Silver ring": "A silver ring worn for ornament, affection, or customary display. In play, it is common personal jewelry.",
    "Drum": "A struck percussion instrument used to keep rhythm, mark signal, or support lively performance. In play, it is a practical and performable instrument.",
    "Fiddle": "A bowed string instrument used for dance music, song support, and lively indoor performance. In play, it is a common portable instrument for skilled players.",
    "Flute": "A wind instrument played by breath and fingered holes for melody, signal, or light performance. In play, it is a portable melodic instrument.",
    "Gamba": "A bowed string instrument with a fuller, courtlier voice than rough dance fiddling. In play, it suits refined or trained musical performance.",
    "Horn": "A blown horn used for signal, call, and certain kinds of martial or outdoor sound. In play, it serves both communication and performance roles.",
    "Lute": "A plucked string instrument associated with song, skilled accompaniment, and cultivated musical play. In play, it is a favored instrument for trained performance.",
    "Shawm": "A loud reed instrument used in open air, ceremony, and forceful ensemble playing. In play, it is a strong public-performance instrument rather than a quiet chamber one.",
    "Trumpet": "A bright brass instrument used for signal, ceremony, and commanding musical presence. In play, it is suited to public, martial, or ceremonial sound.",
    "Bedroll": "A rolled sleeping bundle used to make rough rest more bearable on the road or in camp. In play, it is the standard personal sleeping gear for travel.",
    "Candle": "A simple wax light used indoors or in still conditions where a small controllable flame is enough. In play, it is a modest light source.",
    "Compass": "A magnetic traveling instrument used to hold direction when roads, coastlines, or landmarks are uncertain. In play, it supports navigation when keeping the correct bearing matters.",
    "Flint & steel": "A fire-starting set used to strike sparks into tinder under ordinary field conditions. In play, it is the basic practical tool for making fire on the road.",
    "Hemp rope (10m)": "A length of sturdy hemp rope used for tying, hauling, climbing, and securing loads. In play, it is the default tool for binding, lowering, dragging, or making simple field solutions.",
    "Lantern": "A framed portable lamp that throws steadier light than an open torch and shelters its flame from wind. In play, it is a reliable light source for travel, searching, and work in darkness.",
    "Oil flask": "A small flask of lamp oil used to feed lanterns, lamps, or other flame-bearing gear. In play, it is a practical fuel reserve for carried light.",
    "Tent": "A portable shelter of cloth and poles used to keep weather off during travel, watch, or campaign. In play, it is the standard field shelter for sleeping out.",
    "Torch (10)": "A bundled store of hand torches for bright rough light in darkness, tunnels, and bad outdoor conditions. In play, they are expendable travel light sources.",
    "Walking staff": "A stout staff carried for balance, road support, and ordinary outdoor utility. In play, it is a common travel aid and improvised support tool.",
    "Awl": "A pointed hand tool used to pierce leather, cloth, and other workable materials before stitching or binding. In play, it is a small practical maker's tool.",
    "Chisel": "A cutting tool used with hand pressure or striking force to carve, trim, or shape hard material. In play, it is a standard shaping tool for craft work.",
    "Crowbar": "A heavy prying bar used to lever open crates, doors, lids, and other resistant closures. In play, it is the blunt practical tool for forced opening.",
    "File": "A toothed shaping tool used to smooth, refine, and adjust hard worked surfaces. In play, it is a finishing and fitting tool.",
    "Fishing net": "A net used to catch fish in quantity where line and hook are too slow or uncertain. In play, it is the standard broad-catch fishing tool.",
    "Hammer": "A basic striking tool used for driving, shaping, fastening, and rough practical work. In play, it is one of the standard general craft tools.",
    "Hatchet": "A small one-handed axe used for chopping, splitting, trimming, and rough camp or workyard tasks. In play, it is a practical cutting tool for wood and light labor.",
    "Lock & key": "A fitted lock and matching key used to secure a chest, box, or door against casual entry. In play, it is the standard mundane security fitting.",
    "Saw": "A toothed cutting tool used to divide wood or similar material with steadier control than chopping alone. In play, it is a practical shaping and cutting tool.",
    "Spade": "A digging tool used to cut earth, turn soil, and open ground for work, burial, or field need. In play, it is the standard hand tool for digging.",
    "Whetstone": "A sharpening stone used to restore working edges on blades and tools through steady abrasion. In play, it is the ordinary maintenance tool for edged gear.",
    "Average book": "A serviceable book of ordinary make, meant for reading, storage of text, or modest learned use. In play, it is a standard written volume rather than a prized collectible.",
    "Blank book": "A bound book of empty pages meant for notes, records, copying, or private writing. In play, it is the standard portable volume for keeping written matter.",
    "Ink": "A prepared writing ink used with quill, pen, or similar tools to make durable marks on page or parchment. In play, it is the basic supply for formal writing.",
    "Local map": "A map showing a nearby region, road system, settlement, or familiar district in usable form. In play, it supports travel, planning, and local orientation.",
    "Paper (10 sheets)": "A small packet of paper sheets for writing, drafting, copying, or other recorded use. In play, it is a common writing supply.",
    "Parchment": "Prepared animal skin used as a durable writing surface for important or lasting written matter. In play, it is a sturdier and more valued writing material than common paper.",
    "Quill pen": "A trimmed feather pen used for ordinary writing where ink and a steady hand are available. In play, it is the standard writing implement.",
    "Valuable book": "A better-made or more important book valued for its contents, rarity, workmanship, or ownership. In play, it is a written object of greater material and social worth than an ordinary volume.",
    "Wax & seal": "A writing and sealing set used to close documents and mark them with authority or privacy. In play, it supports formal correspondence and secured letters.",
    "Wax tablet": "A reusable wax writing tablet used for temporary notes, reckoning, and quick practical record. In play, it is a compact erasable writing surface."
    ,
    "Agnus dei": "A small wax devotional bearing the Lamb of God, worn or carried for protection. It is used as a blessed object against danger, evil influence, and unclean presence. In play, it is a religious protective item that may matter in warding, resistance, or rites of blessing.",
    "Auseklis cross amulet": "A small cross-form amulet associated with protective folk symbolism and carried against hostile unseen forces. It is worn to hold off malice, witchcraft, and troubling influence. In play, it is a warding charm that may matter against curses, spirit trouble, or ill intent.",
    "Bulla": "A small worn charm-case or pendant carried close to the body for blessing, identity, or safeguarding. It is kept as a protective token whose power lies in what it encloses or signifies. In play, it is a personal amulet that may matter in protection, continuity, or rites tied to the wearer.",
    "Cold iron nails (4)": "A set of cold iron nails kept for fastening or placing protective barriers where ordinary iron is not enough. They are used to secure thresholds, objects, or workings against troubling beings. In play, they are practical warding materials that may matter in anti-spirit or anti-folk protections.",
    "Daisy wheel amulet": "An amulet marked with the daisy wheel pattern, carried as a turning sign against misfortune and intrusion. It is used to confuse, deflect, or hold off harmful forces. In play, it is a protective folk charm that may matter in warding and household defense.",
    "Demon amulet": "A deliberately charged amulet associated with infernal names, force, or coercive protection. It is kept not for holiness but for dangerous power and the leverage of darker allegiances. In play, it is an occult amulet that may matter in hostile magic, bargains, or risky protection.",
    "Egyptian amulet - Ankh": "A small amulet in the form of the ankh, carried as a sign of life, endurance, and sacred continuity. It is kept for preservation, protection, and vitality through ancient symbolic power. In play, it is an esoteric charm that may matter in blessing, bodily safeguarding, or rites of life.",
    "Egyptian amulet - Cobra": "A cobra-form amulet carried for guarded force, royal protection, and the threat of striking power held in reserve. It is worn as a sign of dangerous defense and watchful presence. In play, it is an exotic protective charm that may matter in warding or retaliatory occult effects.",
    "Egyptian amulet - Crocodile amulet": "A crocodile-form amulet carried for fearsome protection, survival, and mastery of dangerous waters or thresholds. It is used where brute spiritual menace is meant to deter harm. In play, it is an exotic charm that may matter in protection, dominance, or riverine danger.",
    "Egyptian amulet - Djed pillar": "A pillar-form amulet carried for stability, endurance, and standing strength against disruption. It is kept to reinforce what should remain upright, ordered, and unbroken. In play, it is an esoteric support charm that may matter in resistance, preservation, or enduring blessings.",
    "Egyptian amulet - Eye of Horus": "An eye-form amulet carried for protection, restored wholeness, and watchful sacred sight. It is used to hold off harm and preserve the wearer's integrity. In play, it is a protective charm that may matter in warding, healing symbolism, or the detection of hostile influence.",
    "Egyptian amulet - Feather of Ma'at": "A feather-form amulet carried as a sign of truth, right order, and measured judgment. It is kept to align the wearer with balance rather than corruption or falsehood. In play, it may matter in rites of truth, moral weighing, or sacred legitimacy.",
    "Egyptian amulet - Mummified tongue": "A grim funerary amulet associated with speech among the dead, sealed memory, or dangerous grave-working. It is carried for rites that touch corpse, silence, or preserved utterance. In play, it is a necromantic token that may matter in dead-speaking, binding silence, or grave protection.",
    "Egyptian amulet - Scarab": "A scarab amulet carried for renewal, protection, and the stubborn continuance of life through hidden transformation. It is used where preservation and rebirth symbolism are desired. In play, it is an esoteric protective charm that may matter in enduring fortune or rites of renewal.",
    "Egyptian amulet - Ushabti figurine": "A small funerary figurine carried as an ancient token of service, burial duty, or the ordered labor of the dead. It is kept for rites that concern tomb, obedience, or funerary intercession. In play, it may matter in necromantic, burial, or servant-spirit workings.",
    "Engraved spell stone - ALU": "A worked stone engraved with the ALU charm-sign and carried as a compact apotropaic token. It is used to hold off nameless harm through fixed written power. In play, it is an engraved warding object that may matter in curse-aversion, protection, or inscribed magic.",
    "Engraved spell stone - Abracadabra": "A worked stone engraved with the Abracadabra formula and carried against wasting harm, fever, or hostile influence. It is kept as a shrinking written charm whose power lies in the formula itself. In play, it is a protective spell-stone that may matter in illness-aversion or curse resistance.",
    "Engraved spell stone - Abraxas": "A worked stone engraved with the name Abraxas and kept as an occult sign of hidden force and commanded protection. It is carried for leverage over dangerous influences rather than simple piety. In play, it is an esoteric amulet that may matter in occult defense, names, or binding force.",
    "Engraved spell stone - Ajji Majji La Tarajji": "A worked stone engraved with a protective nonsense-charm formula carried to repel evil, malice, and fear. Its force comes from the fixed spoken-written pattern rather than ordinary meaning. In play, it is a protective charm that may matter in folk warding and spell-defense.",
    "Engraved spell stone - Ananizapta": "A worked stone engraved with the Ananizapta charm formula and carried against harm, sickness, and spiritual assault. It is kept as a compact protective inscription whose authority lies in tradition. In play, it is an inscribed ward that may matter in protection and healing-adjacent rites.",
    "Engraved spell stone - Tetragrammaton": "A worked stone engraved with the divine name and carried as a severe token of sacred authority and protection. It is used where holy naming itself is the defense. In play, it is a powerful devotional-ritual object that may matter in warding, exorcistic force, or name-driven rites.",
    "Faith marker": "A small devotional token carried as a visible sign of faith, vow, or pious belonging. It is kept to remind, declare, and reinforce religious commitment. In play, it is a faith-signifying object that may matter in devotion, recognition, or religious rites.",
    "Funeral Wax Candle": "A wax candle prepared for funerary or grave-side use and tied to the dead through rite or intention. It is kept for mourning, vigil, and workings that touch corpse or memory. In play, it is a ritual funerary object that may matter in necromancy, burial protection, or remembrance rites.",
    "Hag stone": "A naturally holed stone carried as a charm against witchcraft, ill luck, and hidden malice. It is kept for protection and for seeing what should not easily be seen. In play, it is an apotropaic folk object that may matter in warding, omen-work, or the detection of hostile magic.",
    "Khamsa": "A hand-shaped protective amulet worn against the evil eye and malicious attention. It is carried to turn aside envy, curses, and wasting bad luck. In play, it is a defensive charm that may matter when resisting ill-fortune, gaze-based harm, or hostile influence.",
    "Lunula": "A crescent-shaped amulet worn for protection, fertility, and feminine or lunar safeguarding. It is kept as a shaped defense against evil attention and bodily harm. In play, it is a protective ornament that may matter in warding, household blessing, or vulnerable-body rites.",
    "Marion marks amulet": "An amulet marked with named signs associated with protective inscription and deliberate warding practice. It is worn for guarded safety through the authority of marked form. In play, it is an inscribed protective token that may matter in household, travel, or curse-aversion rites.",
    "Nazar": "An eye-formed protective amulet carried specifically against the evil eye and the harm of envious sight. It is used to draw, absorb, or turn away that gaze before it reaches the bearer. In play, it is a specialized anti-evil-eye charm that may matter against ill luck and hostile attention.",
    "Necromantic sigil": "A marked token or carried seal associated with grave-work, spirit contact, and the disciplined ordering of necromantic force. It is kept not for comfort but for dangerous authority over the dead. In play, it is an occult sigil that may matter in corpse rites, spirit binding, or grave protection.",
    "Reliquary pendant - acting": "A pendant reliquary claiming saintly connection and carried for grace in performance, bearing, or expressive confidence. It is worn to seek aid where presence and enacted role matter. In play, it is a devotional charm that may matter in performative, social, or theatrical blessing.",
    "Reliquary pendant - command": "A pendant reliquary claiming saintly connection and carried for authority, firmness, and obedience from others. It is worn to reinforce rightful command and spoken direction. In play, it is a devotional aid that may matter in leadership, command presence, or support rites.",
    "Reliquary pendant - courage": "A pendant reliquary claiming saintly connection and carried for courage in danger, suffering, or fearful encounter. It is worn to steady the heart against panic or despair. In play, it is a protective devotional item that may matter in fear resistance and resolve.",
    "Reliquary pendant - craft": "A pendant reliquary claiming saintly connection and carried for steadiness, success, or blessing in practiced craft. It is worn where labor of the hand is tied to devotion. In play, it may matter in making, workmanship, or saint-aided trade ritual.",
    "Reliquary pendant - drowning": "A pendant reliquary claiming saintly connection and carried against drowning, deep water peril, or sudden loss at sea or river. It is worn for bodily preservation in water danger. In play, it is a devotional protective item that may matter in travel, storms, and water rescue.",
    "Reliquary pendant - hanging": "A pendant reliquary claiming saintly connection and carried against execution, strangling death, or judicial doom. It is worn where protection from violent end is sought in extremity. In play, it is a grim devotional charm that may matter in death-aversion or condemned rites.",
    "Reliquary pendant - insanity": "A pendant reliquary claiming saintly connection and carried against madness, spiritual disturbance, or disordered thought. It is worn to preserve inward coherence against corruption or terror. In play, it may matter in mental resilience, disturbance resistance, or healing prayer.",
    "Reliquary pendant - necromantic": "A pendant reliquary claiming saintly connection and carried as protection against the dead, grave corruption, or unclean traffic with corpses. It is worn to preserve the bearer against necromantic danger. In play, it is a specialized devotional ward against corpse and spirit threat.",
    "Reliquary pendant - plague": "A pendant reliquary claiming saintly connection and carried against pestilence, contagion, and communal sickness. It is worn for bodily and household preservation in times of disease. In play, it is a devotional protective item that may matter in plague fear, illness rites, and blessing.",
    "Reliquary pendant - poison": "A pendant reliquary claiming saintly connection and carried against poison, corruption of food or drink, and hidden bodily harm. It is worn to guard against treachery and inward damage. In play, it may matter in poison resistance, testing, or protective prayer.",
    "Reliquary pendant - poverty": "A pendant reliquary claiming saintly connection and carried against ruin, want, or the collapse of household means. It is worn for providence and material steadiness rather than luxury. In play, it may matter in fortune, petition, or household blessing.",
    "Reliquary pendant - protection": "A pendant reliquary containing or claiming some saintly fragment, token, or blessed association. It is worn for sacred protection and the nearness of holy intercession. In play, it is a devotional protective item that may support warding, blessing, or resistance to unclean force.",
    "Reliquary pendant - rough seas": "A pendant reliquary claiming saintly connection and carried against storm, wreck, and the violence of dangerous waters. It is worn by those who fear hard weather more than ordinary drowning alone. In play, it may matter in seafaring protection, voyage blessing, or storm prayer.",
    "Reliquary pendant - sickness": "A pendant reliquary claiming saintly connection and carried against bodily weakness, recurring illness, or chronic affliction. It is worn for ongoing aid rather than sudden miraculous cure. In play, it may matter in healing rites, endurance, and recovery prayer.",
    "Reliquary pendant - suffering": "A pendant reliquary claiming saintly connection and carried for endurance under pain, loss, or prolonged trial. It is worn to bear what cannot quickly be removed. In play, it may matter in composure, ascetic resolve, or patient devotion.",
    "Reliquary pendant - travel": "A pendant reliquary claiming saintly connection and carried for safety on the road, at crossings, and in uncertain foreign places. It is worn for guidance and protection in motion. In play, it may matter in journey blessing, wayfinding confidence, or road protection.",
    "Reliquary pendant - warding": "A pendant reliquary claiming saintly connection and carried specifically for defensive sacred force against malign intrusion. It is worn as a compact holy ward. In play, it is a devotional anti-evil item that may matter in protections, seals, and resistance rites.",
    "Rowan amulet": "An amulet of rowan wood or rowan berries carried against malice, sorcery, and harmful spirits. It belongs to protective folk practice rather than formal church rite. In play, it is a warding charm that may matter against hostile magic, uncanny influence, or spirit trouble.",
    "Snake skin locket": "A small locket containing snake skin, worn as a charm of protection, cunning, or bodily safeguarding. Its meaning comes from sympathetic and folk practice more than formal doctrine. In play, it is an occult protective charm whose exact value depends on the rite, belief, or tradition behind it."
    ,
    "Alembic": "A shaped distilling vessel used to separate, condense, and refine substances through controlled heat. It is a working tool of alchemy rather than ordinary household cooking. In play, it is a specialist apparatus that may matter in alchemical preparation, extraction, and transformation.",
    "Astrolabe": "A measured astronomical instrument used to judge elevation, time, and celestial position. It serves learned observation rather than common travel alone. In play, it may matter in astrology, navigation, and rituals that depend on correct heavenly timing.",
    "Cold iron weapon template": "A prepared cold-iron basis used to work or fit a weapon for hostile use against beings that recoil from iron. It is a material template rather than a finished arm in itself. In play, it is a crafting or ritual support item used to create cold-iron weapon modifications.",
    "Consecrated chalk": "A piece of chalk prepared for sacred marking rather than ordinary writing. It is used to draw protective signs, ritual bounds, and temporary holy marks. In play, it is a consumable support item for warding, sealing, and sanctified preparation.",
    "Grave dirt weapon template": "A prepared coating or material basis tied to grave earth and deathly contagion. It is used to carry corpse-taint or funerary force into a finished weapon treatment. In play, it is a ritual support item used to create grave- or death-aligned weapon modifications.",
    "Holy salt": "Salt prepared through blessing and kept for protection, purification, and the setting of defensive boundaries. It is cast, laid, or carried to oppose corruption and unclean force. In play, it is a consumable ritual aid that may matter in warding, cleansing, and anti-spirit work.",
    "Legendary weapon template": "A prepared basis for fashioning or dedicating a weapon meant to bear an exceptional story, reputation, or inherited force. It is not a finished weapon, but a foundation for making one into something singular. In play, it is a special crafting or ritual support item used to create elevated weapon treatments.",
    "Ritual weapon template": "A prepared basis for turning an ordinary weapon into one suitable for ceremony, sacrifice, or deliberate magical use. It exists to ready the weapon for rite, not merely for battle. In play, it is a crafting or ritual support item used to create ritual weapon modifications.",
    "Silvered weapon template": "A prepared treatment used to silver a weapon or striking surface for later use. It is not a weapon itself, but the material basis for making one fit to wound what silver offends. In play, it is a crafting or ritual support item used to create silvered weapon modifications.",
    "Spirit vessel": "A prepared container meant to receive, confine, or house a spirit under controlled conditions. It is not a mere box or jar, but an object made suitable for dangerous occupancy. In play, it is a ritual object that may matter in binding, containment, and necromantic or summoning work.",
    "Witch bottle": "A sealed bottle prepared as a protective counter-charm against malice, curse-work, and hostile witchcraft. It is buried, hidden, or kept in place to catch or turn back harmful force. In play, it is a warding object that may matter in protection, curse resistance, and household defense.",
    "Arsenic": "A deadly prepared poison kept in powder or mixed dose for covert killing, corruption, or slow bodily ruin. It is valued not as a remedy but as a hidden means of harm. In play, it is a toxic preparation that may matter in poisoning, intrigue, or deliberate murder.",
    "Belladonna drops": "A prepared liquid dose of belladonna used for dangerous bodily effect rather than common nourishment. It is taken or administered for narcotic, visionary, or harmful purposes depending on intent. In play, it is a risky preparation that may matter in sedation, distortion, or poisoning.",
    "Blinding power": "A prepared occult compound meant to rob sight or overwhelm the eyes when properly applied. It is kept for disabling a victim rather than killing them outright. In play, it is a hostile preparation that may matter in blinding, escape, or ritual assault.",
    "Dream draught": "A dark prepared draught meant to draw the drinker into heavy enchanted sleep. It is kept for forced rest, covert dosing, or ritual preparation of the body and mind. In play, it is a consumable preparation that may matter in sleep-working, incapacitation, or occult setup.",
    "Hemlock draught": "A prepared poisonous draught made for bodily collapse, silencing, or death through inward corruption. It is taken or administered as a grave and often final dose. In play, it is a lethal toxic preparation that may matter in assassination, execution, or deliberate self-destruction.",
    "Love philter": "A prepared draught meant to stir attachment, desire, or unnatural inclination in the drinker. It is kept for courtship by force, manipulation, or risky magical longing. In play, it is an influence-bearing preparation that may matter in charm-work, obsession, or social coercion.",
    "Mercury chloride": "A harsh alchemical compound valued for dangerous chemical effect rather than ordinary nourishment or comfort. It is handled as a potent substance whose usefulness is bound to risk. In play, it is an alchemical preparation that may matter in poisoning, treatment, or severe experimental work.",
    "Panacea": "A prized restorative preparation kept as a near-universal answer to sickness, weakness, or bodily disturbance. It is valued for healing promise more than certainty. In play, it is a medicinal preparation that may matter in recovery, cure attempts, or high-value treatment.",
    "Philosopher's stone": "A legendary alchemical substance or prepared token associated with perfect transformation, refinement, and impossible completion. It is not an ordinary draught, but a supreme alchemical preparation bound to deeper operations. In play, it is an exceptional alchemical object that may matter in transformation, mastery, or rare ritual work.",
    "Snake salve": "A prepared salve tied to snake-lore, venom-knowledge, and protective bodily treatment. It is applied rather than drunk, often as a remedy or safeguard against harmful corruption. In play, it is a medicinal or occult salve that may matter in poison-work, skin treatment, or protective preparation.",
    "Theriac": "A compounded antidotal preparation valued for resisting poison, corruption, and inward harm. It is taken as a remedy where danger may already be in the body. In play, it is a medicinal preparation that may matter in recovery, resistance, or emergency treatment.",
    "Toxicon": "A prepared poison meant to wound through taint, dosing, or hidden bodily corruption rather than open force. It is kept as a deliberate harmful substance for blade, cup, or plot. In play, it is a toxic preparation that may matter in poisoning, intrigue, or ritual malice.",
    "Witches butter": "A strange prepared unguent associated with witchcraft, uncanny flight, or dangerous bodily alteration through applied substance. It is not common medicine, but a notorious occult preparation with unsettling uses. In play, it is a magical unguent that may matter in witch-working, transformation, or transgressive ritual."
};

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function applyDescription(item) {
    const category = String(item?._exportFolderName ?? "").trim();
    if (!MUNDANE_CATEGORIES.has(category)) return item;
    const description = DESCRIPTIONS[item.name];
    if (!description) return item;
    return {
        ...item,
        system: {
            ...(item.system ?? {}),
            props: {
                ...(item.system?.props ?? {}),
                Description: description
            }
        }
    };
}

function main() {
    const items = readJson(SOURCE_PATH);
    const updated = items.map(applyDescription);
    if (process.argv.includes("--stdout")) {
        process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
        return;
    }
    writeJson(SOURCE_PATH, updated);
    console.log(`Updated mundane descriptions for ${updated.filter((item) => MUNDANE_CATEGORIES.has(String(item?._exportFolderName ?? "")) && String(item?.system?.props?.Description ?? "").trim()).length} items.`);
}

main();
