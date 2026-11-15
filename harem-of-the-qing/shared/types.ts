/**
 * The shapes of everything the rules engine works with. No numbers and no logic live here:
 * numbers are in balance.ts and logic is in rules/.
 *
 * Every field is read-only. A rule never changes the state it is given; it returns a new one.
 */

export type CharacterId = string;
export type ServantId = string;
export type PalaceId = string;
export type ChildId = string;
export type ClueId = string;
export type SchemeId = string;
export type TrialId = string;

/** The Empress Dowager is always an NPC and holds no rank, so she is known by this fixed id. */
export const EMPRESS_DOWAGER_ID: CharacterId = 'empress_dowager';
/** The Emperor is always an NPC. Standing with him is Favor, so he has no relationship scores. */
export const EMPEROR_ID: CharacterId = 'emperor';

export const PHASES = ['morning', 'day', 'evening', 'night'] as const;
export type Phase = (typeof PHASES)[number];

/** Lowest first. A lady's rank number (1 to 8) is her place in this list. */
export const LADY_RANKS = [
  'second_class_attendant',
  'first_class_attendant',
  'noble_lady',
  'imperial_concubine',
  'consort',
  'noble_consort',
  'imperial_noble_consort',
  'empress',
] as const;
export type LadyRank = (typeof LADY_RANKS)[number];

/** Lowest first. A guard's rank number (1 to 6) is his place in this list. */
export const GUARD_RANKS = [
  'blue_feather_guard',
  'third_class_guard',
  'second_class_guard',
  'first_class_guard',
  'guard_of_the_imperial_presence',
  'emperors_favorite',
] as const;
export type GuardRank = (typeof GUARD_RANKS)[number];

export const LADY_TALENTS = [
  'makeup',
  'poetry',
  'drawing',
  'instruments',
  'singing',
  'dancing',
  'sewing',
  'cooking',
  'plotting',
] as const;
export type LadyTalent = (typeof LADY_TALENTS)[number];

export const GUARD_TALENTS = [
  'swordsmanship',
  'archery',
  'riding',
  'poetry',
  'calligraphy',
  'music',
  'chess',
  'plotting',
] as const;
export type GuardTalent = (typeof GUARD_TALENTS)[number];

/** The attributes a lady can raise by training. Childbearing never rises through training. */
export type TrainableAttribute = 'beauty' | 'intelligence' | 'obedience';

export const ACTIVITY_SPOTS = [
  'dressing_room',
  'study',
  'music_pavilion',
  'dance_terrace',
  'sewing_room',
  'kitchen',
  'courtyard_chores',
  'servants_gossip',
] as const;
export type ActivitySpot = (typeof ACTIVITY_SPOTS)[number];

export type GiftKind = 'homemade_dish' | 'homemade_sewn_item' | 'trinket' | 'fine_jewelry' | 'rare_treasure';

export type ShopItem =
  | 'poison_ingredients'
  | 'fertility_poison_ingredients'
  | 'physician_cure'
  | 'childbearing_restoration'
  | 'premium_cosmetics';

export type Personality = 'ambitious' | 'jealous' | 'gentle' | 'dutiful' | 'schemer';

/** What a lady does on her own while her player is away. */
export interface StandingOrders {
  readonly payRespects: boolean;
  readonly trainTalent: LadyTalent | GuardTalent | null;
  readonly stayGuarded: boolean;
}

export type Controller =
  | { readonly kind: 'player'; readonly online: boolean; readonly standingOrders: StandingOrders }
  | { readonly kind: 'npc'; readonly personality: Personality | null };

/** What a character has done since the Morning. Wiped when the next game day starts. */
export interface DailyRecord {
  readonly paidRespects: boolean;
  /** The Beauty bonus from dolling up, before premium cosmetics double it. 0 when she has not. */
  readonly dollUpBonus: number;
  readonly premiumCosmetics: boolean;
  /** Everyone she has already given a gift to today. Only the first gift to each counts. */
  readonly giftedTo: readonly CharacterId[];
  readonly silverSentToPlayers: number;
  readonly silverReceivedFromPlayers: number;
}

export interface Inventory {
  readonly poisonIngredients: number;
  readonly fertilityPoisonIngredients: number;
}

interface CharacterBase {
  readonly id: CharacterId;
  readonly name: string;
  readonly controller: Controller;
  /** A lady's home palace, or the palace whose gate a guard is posted to. */
  readonly palaceId: PalaceId;
  readonly favor: number;
  readonly beauty: number;
  readonly intelligence: number;
  readonly energy: number;
  readonly silver: number;
  /** Whether the Emperor has noticed this character, so he can pick them in the Evening. */
  readonly noticed: boolean;
  /** The last game day of an illness, or null when well. */
  readonly illThroughDay: number | null;
  /** The last game day in the Cold Palace (a lady) or at the frontier (a guard), or null. */
  readonly exiledThroughDay: number | null;
  readonly inventory: Inventory;
  readonly today: DailyRecord;
}

export interface Lady extends CharacterBase {
  readonly path: 'lady';
  readonly rank: LadyRank;
  readonly obedience: number;
  readonly childbearing: number;
  readonly talents: Readonly<Record<LadyTalent, number>>;
}

export interface Guard extends CharacterBase {
  readonly path: 'guard';
  readonly rank: GuardRank;
  /** Replaces a lady's Obedience. */
  readonly loyalty: number;
  /** Replaces a lady's Childbearing. */
  readonly martialSkill: number;
  readonly rumor: number;
  readonly talents: Readonly<Record<GuardTalent, number>>;
}

/** A lady or a guard, played by a person or by the computer. The same rules apply to all. */
export type Character = Lady | Guard;

export type ServantRole = 'personal_maid' | 'eunuch' | 'cook' | 'guard';

export interface Servant {
  readonly id: ServantId;
  readonly name: string;
  readonly role: ServantRole;
  readonly loyalty: number;
  /** The lady this servant belongs to. Null for palace staff who serve the whole palace. */
  readonly servesId: CharacterId | null;
  readonly palaceId: PalaceId;
  readonly loyaltyFromTipsToday: number;
}

export interface Palace {
  readonly id: PalaceId;
  readonly name: string;
}

export interface Child {
  readonly id: ChildId;
  readonly sex: 'prince' | 'princess';
  readonly motherId: CharacterId;
  /** Who is raising the child now: the mother, or a foster mother after a custody petition. */
  readonly raisedById: CharacterId;
  /** The bond with the mother. */
  readonly bond: number;
  readonly bornOnDay: number;
  readonly visitedToday: boolean;
  /** The game day custody last changed hands, or null when it never has. */
  readonly custodyChangedOnDay: number | null;
}

/** One score for each pair of characters. A pair with no entry are strangers. */
export interface Relationship {
  readonly between: readonly [CharacterId, CharacterId];
  readonly score: number;
}

export type SchemeKind =
  | 'poison'
  | 'fertility_poison'
  | 'burn_belongings'
  | 'bribe_servant_to_lie'
  | 'separate_mother_and_child';

export interface Scheme {
  readonly id: SchemeId;
  readonly kind: SchemeKind;
  readonly schemerId: CharacterId;
  readonly targetId: CharacterId;
  readonly plannedOnDay: number;
  /** The servant who carries it out or lies, when there is one. */
  readonly servantId: ServantId | null;
  readonly outcome: 'pending' | 'worked' | 'failed';
  readonly traced: boolean;
}

export interface Clue {
  readonly id: ClueId;
  /** Real clues come from traced schemes and purchase records. Fabricated ones are bought. */
  readonly evidence: 'real' | 'fabricated';
  readonly culpritId: CharacterId;
  readonly victimId: CharacterId;
  /** The character or servant holding the clue. */
  readonly heldById: CharacterId | ServantId;
  readonly schemeId: SchemeId | null;
  readonly foundOnDay: number;
  /** The last game day the clue can be used. */
  readonly expiresAfterDay: number;
}

export type TrialJudge = 'emperor' | 'empress' | 'empress_dowager';

export interface Trial {
  readonly id: TrialId;
  readonly kind: 'witness' | 'custody' | 'custody_return' | 'impropriety';
  readonly witnessId: CharacterId;
  readonly accusedId: CharacterId;
  readonly clueId: ClueId | null;
  readonly childId: ChildId | null;
  readonly judge: TrialJudge;
  readonly openedOnDay: number;
  /** The first game day the trial may run. Later than openedOnDay when it waits for a player. */
  readonly runsOnDay: number;
  readonly verdict: 'pending' | 'witness_wins' | 'accused_wins';
  readonly overturned: boolean;
}

export type LedgerReason = 'stipend' | 'purchase' | 'gift' | 'tip' | 'transfer';

/** One line of the silver history. Every purchase is logged. */
export interface LedgerEntry {
  readonly day: number;
  readonly phase: Phase;
  readonly characterId: CharacterId;
  readonly direction: 'in' | 'out';
  readonly amount: number;
  readonly reason: LedgerReason;
  /** What was bought or given, when that applies. */
  readonly item: string | null;
  /** The other character or servant involved, when there is one. */
  readonly otherId: string | null;
  /** True for purchases that a spy or an investigator can find, such as poison ingredients. */
  readonly leavesTrail: boolean;
}

/** Everything one court's server holds: its clock, its people and their history. */
export interface CourtState {
  readonly id: string;
  /** The game day, counted from 1. */
  readonly day: number;
  readonly phase: Phase;
  readonly characters: Readonly<Record<CharacterId, Character>>;
  readonly servants: Readonly<Record<ServantId, Servant>>;
  readonly palaces: Readonly<Record<PalaceId, Palace>>;
  readonly children: Readonly<Record<ChildId, Child>>;
  /** Keyed by the two ids in alphabetical order. See rules/relationships.ts. */
  readonly relationships: Readonly<Record<string, Relationship>>;
  readonly clues: Readonly<Record<ClueId, Clue>>;
  readonly schemes: Readonly<Record<SchemeId, Scheme>>;
  readonly trials: Readonly<Record<TrialId, Trial>>;
  readonly ledger: readonly LedgerEntry[];
}
